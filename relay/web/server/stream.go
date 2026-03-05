package server

import (
	"context"
	"io"
	"sync"

	pb "github.com/user/excaliframe/relay/gen/go/excaliframe/v1/models"
	"github.com/user/excaliframe/relay/services"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// CollabBidiStream implements grpcws.BidiStream for the in-process CollabService.
// It bridges the servicekit WebSocket handler to our CollabService.HandleAction.
type CollabBidiStream struct {
	ctx       context.Context
	cancel    context.CancelFunc
	service   *services.CollabService
	sendCh    chan *pb.CollabEvent // events from service → WebSocket client
	sessionId string              // set after first JoinRoom action
	clientId  string              // set after first JoinRoom action
	mu        sync.Mutex
}

// NewCollabBidiStream creates a new bidi stream for the collab service.
func NewCollabBidiStream(ctx context.Context, svc *services.CollabService) *CollabBidiStream {
	ctx, cancel := context.WithCancel(ctx)
	return &CollabBidiStream{
		ctx:     ctx,
		cancel:  cancel,
		service: svc,
		sendCh:  make(chan *pb.CollabEvent, 64),
	}
}

// Send processes a CollabAction from the client (WS → service).
func (s *CollabBidiStream) Send(action *pb.CollabAction) error {
	resp, err := s.service.HandleAction(s.ctx, action)
	if err != nil {
		return err
	}

	// Store session/client info after join
	if join := action.GetJoin(); join != nil && resp != nil {
		if rj := resp.GetRoomJoined(); rj != nil {
			s.mu.Lock()
			s.sessionId = join.GetSessionId()
			s.clientId = rj.GetClientId()
			s.mu.Unlock()
		}
	}

	// Send response event back to the client (if any)
	if resp != nil {
		select {
		case s.sendCh <- resp:
		case <-s.ctx.Done():
			return s.ctx.Err()
		}
	}
	return nil
}

// Recv reads the next event to send to the WebSocket client (service → WS).
func (s *CollabBidiStream) Recv() (*pb.CollabEvent, error) {
	select {
	case event, ok := <-s.sendCh:
		if !ok {
			return nil, io.EOF
		}
		return event, nil
	case <-s.ctx.Done():
		return nil, s.ctx.Err()
	}
}

// CloseSend signals that the client is done sending (half-close).
func (s *CollabBidiStream) CloseSend() error {
	// Trigger leave on half-close
	s.mu.Lock()
	sessionId := s.sessionId
	clientId := s.clientId
	s.mu.Unlock()

	if sessionId != "" && clientId != "" {
		s.service.HandleAction(s.ctx, &pb.CollabAction{
			ClientId: clientId,
			Action: &pb.CollabAction_Leave{
				Leave: &pb.LeaveRoom{Reason: "client closed"},
			},
		})
	}
	close(s.sendCh)
	return nil
}

// ─── grpc.ClientStream interface (required by servicekit) ───────

func (s *CollabBidiStream) Header() (metadata.MD, error) { return nil, nil }
func (s *CollabBidiStream) Trailer() metadata.MD          { return nil }
func (s *CollabBidiStream) CloseSend2() error              { return s.CloseSend() }
func (s *CollabBidiStream) Context() context.Context       { return s.ctx }
func (s *CollabBidiStream) SendMsg(m any) error { return nil }
func (s *CollabBidiStream) RecvMsg(m any) error { return nil }

// Verify CollabBidiStream satisfies the grpcws.BidiStream interface.
var _ grpc.ClientStream = (*CollabBidiStream)(nil)
