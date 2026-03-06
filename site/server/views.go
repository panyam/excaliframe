package server

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	goal "github.com/panyam/goapplib"
)

// Header contains common header data for all pages
type Header struct {
	AppName string
}

// Load populates header data from app context
func (h *Header) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	h.AppName = app.Context.AppName
	return nil, false
}

// HomePage is the marketing/about page
type HomePage struct {
	goal.BasePage
	Header       Header
	GitHubURL    string
	AtlassianURL string
}

func (p *HomePage) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	p.Title = "Excaliframe - Excalidraw for Confluence"
	p.MetaDescription = "Excaliframe brings the power of Excalidraw to Confluence. Create beautiful hand-drawn diagrams, wireframes, and sketches directly in your Confluence pages."
	p.CanonicalUrl = app.Context.BaseURL + "/about/"
	p.DisableSplashScreen = true
	p.Header.AppName = app.Context.AppName
	p.GitHubURL = app.Context.GitHubURL
	p.AtlassianURL = app.Context.AtlassianURL
	return nil, false
}

// PrivacyPolicy page
type PrivacyPolicy struct {
	goal.BasePage
	Header    Header
	GitHubURL string
}

func (p *PrivacyPolicy) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	p.Title = "Privacy Policy - Excaliframe"
	p.MetaDescription = "Privacy Policy for Excaliframe - Excalidraw for Confluence. Learn how we handle your data and protect your privacy."
	p.CanonicalUrl = app.Context.BaseURL + "/privacy/"
	p.DisableSplashScreen = true
	p.Header.AppName = app.Context.AppName
	p.GitHubURL = app.Context.GitHubURL
	return nil, false
}

// TermsOfService page
type TermsOfService struct {
	goal.BasePage
	Header Header
}

func (t *TermsOfService) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	t.Title = "Terms of Service - Excaliframe"
	t.MetaDescription = "Terms of Service for Excaliframe - Excalidraw for Confluence. Review our terms and conditions for using the application."
	t.CanonicalUrl = app.Context.BaseURL + "/terms/"
	t.DisableSplashScreen = true
	t.Header.AppName = app.Context.AppName
	return nil, false
}

// ContactUs page
type ContactUs struct {
	goal.BasePage
	Header          Header
	GitHubURL       string
	GitHubIssuesURL string
}

func (c *ContactUs) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	c.Title = "Contact Us - Excaliframe"
	c.MetaDescription = "Get in touch with the Excaliframe team. Contact us for support, feedback, or questions about Excalidraw for Confluence."
	c.CanonicalUrl = app.Context.BaseURL + "/contact/"
	c.DisableSplashScreen = true
	c.Header.AppName = app.Context.AppName
	c.GitHubURL = app.Context.GitHubURL
	c.GitHubIssuesURL = app.Context.GitHubIssuesURL
	return nil, false
}

// Documentation page
type Documentation struct {
	goal.BasePage
	Header          Header
	GitHubURL       string
	GitHubIssuesURL string
}

func (d *Documentation) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	d.Title = "Documentation - Excaliframe"
	d.MetaDescription = "Excaliframe documentation - Learn how to install and use Excalidraw in Confluence. Includes FAQ, tips, and getting started guide."
	d.CanonicalUrl = app.Context.BaseURL + "/docs/"
	d.DisableSplashScreen = true
	d.Header.AppName = app.Context.AppName
	d.GitHubURL = app.Context.GitHubURL
	d.GitHubIssuesURL = app.Context.GitHubIssuesURL
	return nil, false
}

// PlaygroundDrawing is a placeholder type for EntityListingData.
// Actual drawing data lives in the browser's IndexedDB, not on the server.
// Client JS populates the grid/table after page load.
type PlaygroundDrawing struct {
	Id   string
	Name string
}

// PlaygroundListPage - drawing list page using EntityListing pattern
type PlaygroundListPage struct {
	goal.BasePage
	Header      Header
	ListingData *goal.EntityListingData[*PlaygroundDrawing]
}

func (p *PlaygroundListPage) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	p.Title = "Excaliframe - Diagramming for Confluence and the Web"
	p.MetaDescription = "Try Excalidraw right in your browser. No installation required. Draw diagrams, wireframes, and sketches with the same tool available in our Confluence plugin."
	p.CanonicalUrl = app.Context.BaseURL + "/"
	p.DisableSplashScreen = true
	p.Header.AppName = app.Context.AppName

	// Configure EntityListingData - Items will be empty since data lives in IndexedDB.
	// Client JS populates the grid after loading from IndexedDB.
	p.ListingData = goal.NewEntityListingData[*PlaygroundDrawing]("My Drawings", "/playground/%s/").
		WithCreate("#new-drawing", "New Drawing").
		WithView("/playground/%s/").
		WithEdit("/playground/%s/edit").
		WithDelete("/playground/%s/delete")
	p.ListingData.ViewModeStorageKey = "excaliframe:view-mode"
	p.ListingData.GridContainerId = "drawings-grid"
	p.ListingData.SearchInputId = "search-drawings"
	p.ListingData.SearchPlaceholder = "Search drawings..."
	p.ListingData.EmptyTitle = "No drawings yet"
	p.ListingData.EmptyMessage = "Get started by creating your first drawing."
	p.ListingData.ShowActions = true
	p.ListingData.ShowEditButton = true
	p.ListingData.EnableViewToggle = true
	p.ListingData.SortOptions = nil // Client-side sort only

	return nil, false
}

// PlaygroundDetailPage - drawing detail/edit page
type PlaygroundDetailPage struct {
	goal.BasePage
	Header    Header
	DrawingId string
	Mode      string // "view" or "edit"
}

func (p *PlaygroundDetailPage) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	p.DrawingId = r.PathValue("drawingId")
	if p.DrawingId == "" {
		http.Redirect(w, r, "/", http.StatusFound)
		return nil, true
	}
	p.DisableSplashScreen = true
	p.Header.AppName = app.Context.AppName
	return nil, false
}

// PlaygroundEditPage - drawing edit page (full-screen editor)
type PlaygroundEditPage struct {
	goal.BasePage
	Header    Header
	DrawingId string
}

func (p *PlaygroundEditPage) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	p.DrawingId = r.PathValue("drawingId")
	if p.DrawingId == "" {
		http.Redirect(w, r, "/", http.StatusFound)
		return nil, true
	}
	p.Title = "Edit Drawing - Excaliframe"
	p.DisableSplashScreen = true
	p.CustomHeader = false
	p.Header.AppName = app.Context.AppName
	return nil, false
}

// decodeJoinCode decodes a join code of the form base64url(relayUrl):sessionId:drawingId.
// Returns the relay URL, session ID, drawing ID, and whether decoding succeeded.
func decodeJoinCode(code string) (relayUrl, sessionId, drawingId string, ok bool) {
	parts := strings.SplitN(code, ":", 3)
	if len(parts) < 3 || parts[1] == "" || parts[2] == "" {
		return "", "", "", false
	}
	decoded, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", "", "", false
	}
	return string(decoded), parts[1], parts[2], true
}

// SetupRoutes registers all page routes
func SetupRoutes(app *goal.App[*ExcaliframeApp]) *http.ServeMux {
	mux := http.NewServeMux()

	goal.Register[*PlaygroundListPage](app, mux, "/")
	goal.Register[*HomePage](app, mux, "/about/")
	goal.Register[*PrivacyPolicy](app, mux, "/privacy/")
	goal.Register[*TermsOfService](app, mux, "/terms/")
	goal.Register[*ContactUs](app, mux, "/contact/")
	goal.Register[*Documentation](app, mux, "/docs/")
	goal.Register[*PlaygroundDetailPage](app, mux, "/playground/{drawingId}/")
	goal.Register[*PlaygroundEditPage](app, mux, "/playground/{drawingId}/edit")

	// Serve robots.txt and sitemap.xml from root
	mux.HandleFunc("/robots.txt", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/robots.txt")
	})
	mux.HandleFunc("/sitemap.xml", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		http.ServeFile(w, r, "./static/sitemap.xml")
	})

	// Redirect without trailing slash
	mux.HandleFunc("/privacy", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/privacy/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/terms", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/terms/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/contact", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/contact/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/docs", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/docs/", http.StatusMovedPermanently)
	})
	// Cross-origin join: /join/{code} decodes a join code and redirects to the editor
	mux.HandleFunc("/join/{code}", func(w http.ResponseWriter, r *http.Request) {
		code := r.PathValue("code")
		relayUrl, sessionId, drawingId, ok := decodeJoinCode(code)
		if !ok {
			http.Error(w, "Invalid join code", http.StatusBadRequest)
			return
		}
		target := fmt.Sprintf("/playground/%s/edit?autoJoin=1&relay=%s&session=%s",
			url.PathEscape(drawingId),
			url.QueryEscape(relayUrl),
			url.QueryEscape(sessionId))
		http.Redirect(w, r, target, http.StatusFound)
	})

	// Redirect old /playground/ URLs to root
	mux.HandleFunc("/playground/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/playground", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("/about", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/about/", http.StatusMovedPermanently)
	})

	return mux
}
