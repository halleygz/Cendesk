package croc

type Direction string

const (
	DirectionSend    Direction = "send"
	DirectionReceive Direction = "receive"
)

type State string

const (
	StatePreparing    State = "preparing"
	StateWaiting      State = "waiting"
	StateConnecting   State = "connecting"
	StateTransferring State = "transferring"
	StateFinishing    State = "finishing"
	StateCompleted    State = "completed"
	StateFailed       State = "failed"
	StateCancelled    State = "cancelled"
)

type Event struct {
	Type        string    `json:"type"`
	Direction   Direction `json:"direction,omitempty"`
	State       State     `json:"state,omitempty"`
	Timestamp   int64     `json:"timestamp"`
	Code        string    `json:"code,omitempty"`
	Name        string    `json:"name,omitempty"`
	Count       int       `json:"count,omitempty"`
	Size        int64     `json:"size,omitempty"`
	DisplaySize string    `json:"displaySize,omitempty"`
	Percent     int       `json:"percent,omitempty"`
	Transferred string    `json:"transferred,omitempty"`
	Total       string    `json:"total,omitempty"`
	Speed       string    `json:"speed,omitempty"`
	ETA         string    `json:"eta,omitempty"`
	Message     string    `json:"message,omitempty"`
	Destination string    `json:"destination,omitempty"`
	Stream      string    `json:"stream,omitempty"`
}

type Snapshot struct {
	ID          string    `json:"id"`
	Direction   Direction `json:"direction"`
	State       State     `json:"state"`
	Destination string    `json:"destination,omitempty"`
	Events      []Event   `json:"events"`
}

type FileItem struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Size         int64  `json:"size"`
	Type         string `json:"type"`
	LastModified int64  `json:"lastModified"`
	Kind         string `json:"kind"`
	Path         string `json:"path"`
}
