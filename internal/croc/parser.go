package croc

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	ansiPattern       = regexp.MustCompile(`\x1b\[[0-?]*[ -/]*[@-~]`)
	codePattern       = regexp.MustCompile(`(?i)^Code is:\s*(.+)$`)
	collectionPattern = regexp.MustCompile(`(?i)^Sending\s+(\d+)\s+files?(?:\s+and\s+(\d+)\s+folders?)?\s+\(([^)]+)\)`)
	singleFilePattern = regexp.MustCompile(`(?i)^(?:Sending|Receiving|Receive)\s+'([^']+)'\s+\(([^)]+)\)`)
	percentPattern    = regexp.MustCompile(`(?:^|\s)(\d{1,3})%`)
	countsPattern     = regexp.MustCompile(`(?i)\(([\d.]+\s*[KMGT]?I?B)\s*/\s*([\d.]+\s*[KMGT]?I?B)`)
	speedPattern      = regexp.MustCompile(`(?i)([\d.]+\s*[KMGT]?I?B/s)`)
	etaPattern        = regexp.MustCompile(`(?i)\[([^\]]+?)(?:\s+remaining|\s+left)\]`)
	etaAltPattern     = regexp.MustCompile(`(?i)ETA[:\s]+([\w:]+)`)
)

type Parser struct {
	direction Direction
	emit      func(Event)
	buffer    string
}

func NewParser(direction Direction, emit func(Event)) *Parser {
	return &Parser{direction: direction, emit: emit}
}

func (p *Parser) Feed(chunk string, stream string) {
	normalized := ansiPattern.ReplaceAllString(p.buffer+chunk, "")
	lines := regexp.MustCompile(`[\r\n]+`).Split(normalized, -1)
	if strings.HasSuffix(normalized, "\n") || strings.HasSuffix(normalized, "\r") {
		p.buffer = ""
	} else if len(lines) > 0 {
		p.buffer = lines[len(lines)-1]
		lines = lines[:len(lines)-1]
	}
	for _, line := range lines {
		p.parseLine(line, stream)
	}
}

func (p *Parser) Flush(stream string) {
	if strings.TrimSpace(p.buffer) != "" {
		p.parseLine(p.buffer, stream)
	}
	p.buffer = ""
}

func (p *Parser) event(event Event) {
	event.Timestamp = time.Now().UnixMilli()
	p.emit(event)
}

func (p *Parser) state(state State, message string) {
	p.event(Event{Type: "state-changed", State: state, Message: message})
}

func (p *Parser) parseLine(rawLine string, stream string) {
	line := strings.TrimSpace(rawLine)
	if line == "" {
		return
	}
	if match := codePattern.FindStringSubmatch(line); match != nil {
		p.event(Event{Type: "code-generated", Code: strings.TrimSpace(match[1])})
		p.state(StateWaiting, "Waiting for the receiver")
		return
	}
	if match := collectionPattern.FindStringSubmatch(line); match != nil {
		files := atoi(match[1])
		folders := 0
		if len(match) > 2 && match[2] != "" {
			folders = atoi(match[2])
		}
		if files+folders > 0 {
			p.event(Event{Type: "file-discovered", Name: strconv.Itoa(files) + " files", Count: files + folders, DisplaySize: match[3]})
		}
		return
	}
	if match := singleFilePattern.FindStringSubmatch(line); match != nil {
		p.event(Event{Type: "file-discovered", Name: match[1], Count: 1, DisplaySize: match[2]})
		return
	}
	lower := strings.ToLower(line)
	if strings.Contains(lower, "securing channel") || strings.Contains(lower, "connecting") || strings.Contains(lower, "establishing connection") {
		p.state(StateConnecting, "Securing the connection")
	} else if strings.HasPrefix(line, "Sending (->") || strings.HasPrefix(line, "Receiving (<-") || strings.Contains(lower, "transferring") {
		if p.direction == DirectionSend {
			p.state(StateTransferring, "Uploading files")
		} else {
			p.state(StateTransferring, "Downloading files")
		}
	} else if strings.Contains(lower, "finishing") || strings.Contains(lower, "verifying") || strings.Contains(lower, "hashing") {
		p.state(StateFinishing, "Verifying transfer")
	}
	if match := percentPattern.FindStringSubmatch(line); match != nil {
		percent := atoi(match[1])
		if percent > 100 {
			percent = 100
		}
		event := Event{Type: "progress-updated", Percent: percent}
		if counts := countsPattern.FindStringSubmatch(line); counts != nil {
			event.Transferred = counts[1]
			event.Total = counts[2]
		}
		p.event(event)
	}
	if match := speedPattern.FindStringSubmatch(line); match != nil {
		p.event(Event{Type: "speed-updated", Speed: match[1]})
	}
	if match := etaPattern.FindStringSubmatch(line); match != nil {
		p.event(Event{Type: "eta-updated", ETA: match[1]})
	} else if match := etaAltPattern.FindStringSubmatch(line); match != nil {
		p.event(Event{Type: "eta-updated", ETA: match[1]})
	}
	if strings.Contains(lower, "warning") || strings.Contains(lower, "warn") || strings.Contains(lower, "error") || strings.Contains(lower, "failed") || strings.Contains(lower, "unable") || strings.Contains(lower, "refused") || strings.Contains(lower, "not found") {
		p.event(Event{Type: "warning", Message: line})
	}
	p.event(Event{Type: "output", Stream: stream, Message: line})
}

func atoi(value string) int {
	parsed, _ := strconv.Atoi(value)
	return parsed
}
