package croc

import (
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"strings"
)

func InspectPath(path string) (FileItem, error) {
	if !filepath.IsAbs(path) {
		return FileItem{}, fmt.Errorf("%s is not an absolute path", path)
	}
	info, err := os.Stat(path)
	if err != nil {
		return FileItem{}, err
	}
	kind := "file"
	mimeType := mime.TypeByExtension(strings.ToLower(filepath.Ext(path)))
	if info.IsDir() {
		kind = "folder"
		mimeType = "folder"
	} else if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	return FileItem{
		ID:           fmt.Sprintf("%s-%d", path, info.ModTime().UnixMilli()),
		Name:         filepath.Base(path),
		Size:         info.Size(),
		Type:         mimeType,
		LastModified: info.ModTime().UnixMilli(),
		Kind:         kind,
		Path:         path,
	}, nil
}
