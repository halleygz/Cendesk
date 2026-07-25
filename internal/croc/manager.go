package croc

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"time"
)

type transfer struct {
	Snapshot
	cancel context.CancelFunc
}

type Manager struct {
	mu        sync.Mutex
	transfers map[string]*transfer
	emit      func(Event)
}

func NewManager() *Manager {
	return &Manager{transfers: map[string]*transfer{}, emit: func(Event) {}}
}

func (m *Manager) SetEmitter(emit func(Event)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.emit = emit
}

func (m *Manager) StartSend(paths []string) (Snapshot, error) {
	if len(paths) == 0 {
		return Snapshot{}, fmt.Errorf("select at least one file or folder to send")
	}
	for _, path := range paths {
		if _, err := os.Stat(path); err != nil {
			return Snapshot{}, err
		}
	}
	args := append([]string{"--yes", "--disable-clipboard", "send"}, paths...)
	return m.start(DirectionSend, args, nil, "")
}

func (m *Manager) StartReceive(code string, destination string) (Snapshot, error) {
	if len([]rune(code)) < 6 {
		return Snapshot{}, fmt.Errorf("enter a valid Croc transfer code")
	}
	if _, err := os.Stat(destination); err != nil {
		return Snapshot{}, err
	}
	return m.start(DirectionReceive, []string{"--yes", "--overwrite", "--disable-clipboard", "--out", destination}, []string{"CROC_SECRET=" + code}, destination)
}

func (m *Manager) Cancel(id string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	transfer, ok := m.transfers[id]
	if !ok || transfer.State == StateCompleted || transfer.State == StateFailed || transfer.State == StateCancelled {
		return false
	}
	transfer.State = StateCancelled
	transfer.cancel()
	return true
}

func (m *Manager) CancelAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, transfer := range m.transfers {
		transfer.cancel()
	}
}

func (m *Manager) start(direction Direction, args []string, extraEnv []string, destination string) (Snapshot, error) {
	if _, err := exec.LookPath("croc"); err != nil {
		return Snapshot{}, fmt.Errorf("croc is not installed or is not available on PATH")
	}
	id, err := newID()
	if err != nil {
		return Snapshot{}, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	transfer := &transfer{Snapshot: Snapshot{ID: id, Direction: direction, State: StatePreparing, Destination: destination, Events: []Event{}}, cancel: cancel}
	m.mu.Lock()
	m.transfers[id] = transfer
	m.mu.Unlock()

	m.record(id, Event{Type: "transfer-started", Direction: direction, State: StatePreparing})
	if direction == DirectionSend {
		m.record(id, Event{Type: "state-changed", State: StatePreparing, Message: "Preparing files"})
	} else {
		m.record(id, Event{Type: "state-changed", State: StatePreparing, Message: "Preparing destination"})
	}

	command := exec.CommandContext(ctx, "croc", args...)
	command.Env = append(os.Environ(), extraEnv...)
	stdout, err := command.StdoutPipe()
	if err != nil {
		cancel()
		return Snapshot{}, err
	}
	stderr, err := command.StderrPipe()
	if err != nil {
		cancel()
		return Snapshot{}, err
	}
	parser := NewParser(direction, func(event Event) { m.record(id, event) })
	if err := command.Start(); err != nil {
		cancel()
		return Snapshot{}, err
	}
	go scanPipe(stdout, "stdout", parser, func(message string) { m.record(id, Event{Type: "warning", Message: message}) })
	go scanPipe(stderr, "stderr", parser, func(message string) { m.record(id, Event{Type: "warning", Message: message}) })
	go func() {
		err := command.Wait()
		parser.Flush("stderr")
		m.finish(id, err, destination)
	}()
	return m.snapshot(id), nil
}

func scanPipe(pipe io.Reader, stream string, parser *Parser, warn func(string)) {
	buffer := make([]byte, 32*1024)
	for {
		count, err := pipe.Read(buffer)
		if count > 0 {
			parser.Feed(string(buffer[:count]), stream)
		}
		if err == nil {
			continue
		}
		if err != io.EOF {
			warn(fmt.Sprintf("error reading croc %s: %s", stream, err.Error()))
		}
		return
	}
}

func (m *Manager) finish(id string, err error, destination string) {
	m.mu.Lock()
	state := m.transfers[id].State
	m.mu.Unlock()
	if state == StateCancelled {
		m.record(id, Event{Type: "transfer-cancelled"})
		return
	}
	if err != nil {
		m.record(id, Event{Type: "transfer-failed", Message: fmt.Sprintf("croc exited with %s", err.Error())})
		return
	}
	m.record(id, Event{Type: "transfer-completed", Destination: destination})
}

func (m *Manager) record(id string, event Event) {
	event.Timestamp = time.Now().UnixMilli()
	m.mu.Lock()
	transfer, ok := m.transfers[id]
	if !ok {
		m.mu.Unlock()
		return
	}
	if event.Type == "state-changed" && event.State != "" {
		transfer.State = event.State
	}
	if event.Type == "transfer-completed" {
		transfer.State = StateCompleted
	}
	if event.Type == "transfer-failed" {
		transfer.State = StateFailed
	}
	if event.Type == "transfer-cancelled" {
		transfer.State = StateCancelled
	}
	transfer.Events = append(transfer.Events, event)
	if len(transfer.Events) > 500 {
		transfer.Events = transfer.Events[1:]
	}
	emit := m.emit
	m.mu.Unlock()
	emit(event)
}

func (m *Manager) snapshot(id string) Snapshot {
	m.mu.Lock()
	defer m.mu.Unlock()
	transfer := m.transfers[id]
	events := append([]Event(nil), transfer.Events...)
	return Snapshot{ID: transfer.ID, Direction: transfer.Direction, State: transfer.State, Destination: transfer.Destination, Events: events}
}

func newID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
