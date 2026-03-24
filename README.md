# HSV Contour Viewer

This tool helps you:

- extract a target color in HSV space
- clean the mask with morphology
- draw contours and bounding boxes
- preview source, mask, edges, and contour overlay in one dashboard
- capture the desktop by default instead of opening a camera

## Features

- live desktop capture, or image/video input
- real-time HSV tuning with trackbars
- hue wrap-around support for colors like red
- contour filtering by area
- click-to-sample color from the source image
- save the current HSV parameters to a JSON file
- red, green, and blue presets with keyboard shortcuts
- separate Chinese guide window for slider explanations

## Why The Sliders Are In English

OpenCV HighGUI trackbars on Windows often garble Chinese text.
To avoid unreadable labels, the sliders use short English names such as `H low` and `S high`,
and the program opens a separate `Chinese Guide` window that shows the full Chinese explanation.

## Install

1. Install Python 3.10 or newer.
2. Install the dependencies:

```bash
pip install -r requirements.txt
```

## Mobile Web App

There is now a browser version for phones in [mobile_web\index.html](/D:/循迹小车/mobile_web/index.html).
It uses the phone camera directly in the browser and performs HSV thresholding, morphology cleanup,
component filtering, edge extraction, and tap-to-sample color on the front end.

Local preview:

```bash
python serve_mobile_web.py
```

If `python` is not in your PATH, you can also run:

```bash
.venv\Scripts\python.exe serve_mobile_web.py
```

Then open:

- desktop preview: `http://127.0.0.1:8080`
- LAN preview: `http://<your-lan-ip>:8080`

Important:

- phone camera access usually requires `HTTPS` or `localhost`
- if you want to use the camera on your phone, the easiest path is to deploy `mobile_web/` to a static HTTPS host
- good options are GitHub Pages, Cloudflare Pages, or your own HTTPS server

## Run

Capture the primary monitor:

```bash
python color_contour_viewer.py
```

Capture part of the screen:

```bash
python color_contour_viewer.py --monitor 1 --left 200 --top 100 --width 1280 --height 720
```

Open a video or image:

```bash
python color_contour_viewer.py --input demo.mp4
python color_contour_viewer.py --input sample.jpg
```

Load a saved config:

```bash
python color_contour_viewer.py --config saved_hsv_config.json
```

## Controls

- `q` or `Esc`: quit
- `Space`: pause or resume live input
- `s`: save the current parameters
- `r`: reset sliders to defaults
- `1`: red preset
- `2`: green preset
- `3`: blue preset
- left click on the `Source` or `Contours` panel: sample the clicked color

## Notes

- If you capture the same monitor that shows the dashboard, you may see a recursive "screen inside screen" effect.
- Move the windows to another monitor or limit the capture region with `--left`, `--top`, `--width`, and `--height` if needed.
- If `H low` is greater than `H high`, the program treats the hue range as wrapping around 0. This is useful for red.
- `Blur`, `Open`, and `Close` are converted to odd kernel sizes internally.
- `Min area` helps ignore tiny noisy blobs.
