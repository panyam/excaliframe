package server

import (
	"net/http"

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

// HomePage is the landing page
type HomePage struct {
	goal.BasePage
	Header       Header
	GitHubURL    string
	AtlassianURL string
}

func (p *HomePage) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	p.Title = "Excaliframe - Excalidraw for Confluence"
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
	c.DisableSplashScreen = true
	c.Header.AppName = app.Context.AppName
	c.GitHubURL = app.Context.GitHubURL
	c.GitHubIssuesURL = app.Context.GitHubIssuesURL
	return nil, false
}

// SetupRoutes registers all page routes
func SetupRoutes(app *goal.App[*ExcaliframeApp]) *http.ServeMux {
	mux := http.NewServeMux()

	goal.Register[*HomePage](app, mux, "/")
	goal.Register[*PrivacyPolicy](app, mux, "/privacy/")
	goal.Register[*TermsOfService](app, mux, "/terms/")
	goal.Register[*ContactUs](app, mux, "/contact/")

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

	return mux
}
