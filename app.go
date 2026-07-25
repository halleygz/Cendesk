package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"file-atlas/internal/croc"

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
	if err != nil || len(paths) == 0 {
		return nil, err
	}
	return a.InspectPaths(paths)
}

func (a *App) SelectFolder() ([]croc.FileItem, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "Choose a folder to send",
		CanCreateDirectories: false,
		ShowHiddenFiles:      true,
	})
	if err != nil || path == "" {
		return nil, err
	}
	return a.InspectPaths([]string{path})
}

func (a *App) InspectPaths(paths []string) ([]croc.FileItem, error) {
	items := make([]croc.FileItem, 0, len(paths))
	for _, path := range paths {
		item, err := croc.InspectPath(path)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (a *App) StartSend(paths []string) (croc.Snapshot, error) {
	return a.manager.StartSend(paths)
}

func (a *App) StartReceive(code string) (croc.Snapshot, error) {
	destination, err := downloadsDir()
	if err != nil {
		return croc.Snapshot{}, err
	}
	return a.manager.StartReceive(code, destination)
}

func (a *App) CancelTransfer(id string) bool {
	return a.manager.Cancel(id)
}

func (a *App) OpenFolder(path string) error {
	if _, err := os.Stat(path); err != nil {
		return err
	}
	runtime.BrowserOpenURL(a.ctx, "file://"+filepath.Clean(path))
	return nil
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
