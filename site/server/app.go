package server

// ExcaliframeApp holds app-level configuration
type ExcaliframeApp struct {
	AppName         string
	BaseURL         string
	GitHubURL       string
	GitHubIssuesURL string
	AtlassianURL    string
}

// NewExcaliframeApp creates a new app context with defaults
func NewExcaliframeApp() *ExcaliframeApp {
	return &ExcaliframeApp{
		AppName:         "Excaliframe",
		BaseURL:         "https://excaliframe.com",
		GitHubURL:       "https://github.com/panyam/excaliframe",
		GitHubIssuesURL: "https://github.com/panyam/excaliframe/issues",
		AtlassianURL:    "https://marketplace.atlassian.com/apps/", // TODO: Update with actual marketplace URL
	}
}
