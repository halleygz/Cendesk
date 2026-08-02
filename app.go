package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"cendesk/internal/croc"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx     context.Context
	manager *croc.Manager
}

func NewApp() *App {
	return &App{manager: croc.NewManager()}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.manager.SetEmitter(func(event croc.Event) {
		runtime.EventsEmit(ctx, "croc:event", event)
	})
}

func (a *App) Shutdown(ctx context.Context) {
	a.manager.CancelAll()
}

func (a *App) SelectPaths() ([]croc.FileItem, error) {
	paths, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "Choose files to send",
		CanCreateDirectories: false,
		ShowHiddenFiles:      true,
	})
	if err != nil {
		return nil, userError("choose files", "The file picker could not be opened.", err)
	}
	if len(paths) == 0 {
		return []croc.FileItem{}, nil
	}
	return a.InspectPaths(paths)
}

func (a *App) SelectFolder() ([]croc.FileItem, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "Choose a folder to send",
		CanCreateDirectories: false,
		ShowHiddenFiles:      true,
	})
	if err != nil {
		return nil, userError("choose folder", "The folder picker could not be opened.", err)
	}
	if path == "" {
		return []croc.FileItem{}, nil
	}
	return a.InspectPaths([]string{path})
}

func (a *App) InspectPaths(paths []string) ([]croc.FileItem, error) {
	items := make([]croc.FileItem, 0, len(paths))
	for _, path := range paths {
		item, err := croc.InspectPath(path)
		if err != nil {
			return nil, userError("inspect selected path", "One or more selected files could not be added.", err)
		}
		items = append(items, item)
	}
	return items, nil
}

func (a *App) StartSend(paths []string) (croc.Snapshot, error) {
	snapshot, err := a.manager.StartSend(paths)
	if err != nil {
		return croc.Snapshot{}, userError("start send", "The transfer could not be started.", err)
	}
	return snapshot, nil
}

func (a *App) StartReceive(code string) (croc.Snapshot, error) {
	destination, err := downloadsDir()
	if err != nil {
		return croc.Snapshot{}, userError("prepare receive destination", "The receive folder is not available.", err)
	}
	snapshot, err := a.manager.StartReceive(code, destination)
	if err != nil {
		return croc.Snapshot{}, userError("start receive", "The transfer could not be started.", err)
	}
	return snapshot, nil
}

func (a *App) CancelTransfer(id string) bool {
	return a.manager.Cancel(id)
}

func (a *App) OpenFolder(path string) error {
	if _, err := os.Stat(path); err != nil {
		return userError("open destination folder", "The destination folder is not available.", err)
	}
	runtime.BrowserOpenURL(a.ctx, "file://"+filepath.Clean(path))
	return nil
}

func (a *App) ReportClientError(message string) {
	log.Printf("frontend error: %s", message)
}

func userError(action, message string, err error) error {
	log.Printf("%s: %v", action, err)
	return errors.New(message)
}

func downloadsDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	destination := filepath.Join(home, "Downloads")
	if err := os.MkdirAll(destination, 0o755); err != nil {
		return "", fmt.Errorf("prepare Downloads folder: %w", err)
	}
	return destination, nil
}
