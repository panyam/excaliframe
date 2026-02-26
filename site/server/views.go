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
	p.MetaDescription = "Excaliframe brings the power of Excalidraw to Confluence. Create beautiful hand-drawn diagrams, wireframes, and sketches directly in your Confluence pages."
	p.CanonicalUrl = app.Context.BaseURL + "/"
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

// PlaygroundPage - interactive tool playground
type PlaygroundPage struct {
	goal.BasePage
	Header Header
}

func (p *PlaygroundPage) Load(r *http.Request, w http.ResponseWriter, app *goal.App[*ExcaliframeApp]) (error, bool) {
	p.Title = "Playground - Excaliframe"
	p.MetaDescription = "Try Excalidraw right in your browser. No installation required. Draw diagrams, wireframes, and sketches with the same tool available in our Confluence plugin."
	p.CanonicalUrl = app.Context.BaseURL + "/playground/"
	p.DisableSplashScreen = true
	p.CustomHeader = false
	p.Header.AppName = app.Context.AppName
	return nil, false
}

// SetupRoutes registers all page routes
func SetupRoutes(app *goal.App[*ExcaliframeApp]) *http.ServeMux {
	mux := http.NewServeMux()

	goal.Register[*HomePage](app, mux, "/")
	goal.Register[*PrivacyPolicy](app, mux, "/privacy/")
	goal.Register[*TermsOfService](app, mux, "/terms/")
	goal.Register[*ContactUs](app, mux, "/contact/")
	goal.Register[*Documentation](app, mux, "/docs/")
	goal.Register[*PlaygroundPage](app, mux, "/playground/")

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
	mux.HandleFunc("/playground", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/playground/", http.StatusMovedPermanently)
	})

	return mux
}
