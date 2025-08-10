package main

import (
	"fmt"
	"log"
	"os/exec"

	"github.com/gordonklaus/portaudio"
)

func main() {
    portaudio.Initialize()
    defer portaudio.Terminate()

    host, err := portaudio.DefaultHostApi()
    if err != nil {
        log.Fatal("Host API fail:", err)
    }
    dev := host.DefaultInputDevice
    sampleRate := float64(dev.DefaultSampleRate)
    log.Printf("Input device %q sl: %.0f Hz", dev.Name, sampleRate)

    framesPerBuffer := int(sampleRate / 50)

    in := make([]int16, framesPerBuffer)
    stream, err := portaudio.OpenDefaultStream(1, 0, float64(sampleRate), len(in), &in)
    if err != nil {
        log.Fatal(err)
    }
    if err := stream.Start(); err != nil {
        log.Fatal(err)
    }
    defer stream.Stop()

    cmd := exec.Command(
        "ffmpeg",
        "-f", "s16le",
        "-ar", fmt.Sprintf("%d", int(sampleRate)),
        "-ac", "1",
        "-i", "pipe:0",
        "-c:a", "libopus",
        "-b:a", "64k",
        "-vbr", "on",
        "-compression_level", "10",
        "-payload_type", "96",
        "-fflags", "nobuffer",
        "-flags", "low_delay",
        "-flush_packets", "1",
        "-probesize", "32",
        "-analyzeduration", "0",
        "-muxdelay", "0",
        "-f", "rtp",
        "udp://127.0.0.1:5004",
    )
    stdin, err := cmd.StdinPipe()
    if err != nil {
        log.Fatal(err)
    }
    cmd.Stderr = cmd.Stdout

    if err := cmd.Start(); err != nil {
        log.Fatal(err)
    }
    defer cmd.Process.Kill()

    buf := make([]byte, framesPerBuffer*2)
    for {
        if err := stream.Read(); err != nil {
            if err == portaudio.InputOverflowed {
                continue
            }
            log.Println("stream read error:", err)
            break
        }
        for i, v := range in {
            buf[2*i] = byte(v)
            buf[2*i+1] = byte(v >> 8)
        }
        if _, err := stdin.Write(buf); err != nil {
            log.Println("stdin write error:", err)
            break
        }
    }

    cmd.Wait()
}
