from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import mss
import numpy as np
from PIL import Image, ImageDraw, ImageFont


WINDOW_DASHBOARD = "HSV Dashboard"
WINDOW_CONTROLS = "HSV Controls"
WINDOW_GUIDE = "Chinese Guide"
WINDOW_CONSOLE_HINT = (
    "OpenCV trackbars do not render Chinese reliably on Windows. "
    "Use the 'Chinese Guide' window for the full explanation."
)

TRACKBAR_LOW_H = "H low"
TRACKBAR_HIGH_H = "H high"
TRACKBAR_LOW_S = "S low"
TRACKBAR_HIGH_S = "S high"
TRACKBAR_LOW_V = "V low"
TRACKBAR_HIGH_V = "V high"
TRACKBAR_BLUR = "Blur"
TRACKBAR_OPEN = "Open"
TRACKBAR_CLOSE = "Close"
TRACKBAR_CANNY_LOW = "Edge low"
TRACKBAR_CANNY_HIGH = "Edge high"
TRACKBAR_MIN_AREA = "Min area"

GUIDE_TITLE_ZH = (
    "\u4e2d\u6587\u8bf4\u660e\uff1aOpenCV \u5728 Windows \u4e0a\u7684\u6ed1\u6761"
    "\u63a7\u4ef6\u5bf9\u4e2d\u6587\u652f\u6301\u4e0d\u7a33\u5b9a\uff0c"
    "\u6240\u4ee5\u5de6\u4fa7\u6ed1\u6761\u7528\u82f1\u6587\u7b80\u5199\uff0c"
    "\u8fd9\u4e2a\u7a97\u53e3\u4e13\u95e8\u663e\u793a\u4e2d\u6587\u89e3\u91ca\u3002"
)
GUIDE_LINES_ZH = [
    "H low / H high\uff1a\u8272\u76f8\u8303\u56f4\uff0c\u53ef\u7c97\u7565\u7406\u89e3\u6210 0\u7ea2 30\u9ec4 60\u7eff 90\u9752 120\u84dd 150\u7d2b",
    "S low / S high\uff1a\u9971\u548c\u5ea6\u8303\u56f4\uff0c\u8d8a\u5927\u989c\u8272\u8d8a\u7eaf\uff0c\u8d8a\u5c0f\u8d8a\u63a5\u8fd1\u7070\u767d",
    "V low / V high\uff1a\u660e\u5ea6\u8303\u56f4\uff0c\u8d8a\u5927\u8d8a\u4eae\uff0c\u8d8a\u5c0f\u8d8a\u6697",
    "Blur\uff1a\u5148\u505a\u8f7b\u5fae\u6a21\u7cca\uff0c\u51cf\u5c11\u5c0f\u566a\u70b9\u548c\u6bdb\u523a",
    "Open\uff1a\u5f00\u8fd0\u7b97\uff0c\u53bb\u6389\u96f6\u6563\u5c0f\u767d\u70b9",
    "Close\uff1a\u95ed\u8fd0\u7b97\uff0c\u586b\u8865\u8f6e\u5ed3\u5185\u7684\u5c0f\u9ed1\u6d1e",
    "Edge low / Edge high\uff1aCanny \u8fb9\u7f18\u9608\u503c\uff0c\u51b3\u5b9a\u8fb9\u754c\u7075\u654f\u5ea6",
    "Min area\uff1a\u6700\u5c0f\u9762\u79ef\uff0c\u7528\u6765\u8fc7\u6ee4\u5f88\u5c0f\u7684\u8bef\u68c0\u8272\u5757",
    "HSV \u4e0d\u662f RGB\uff1aH \u770b\u989c\u8272\uff0cS \u770b\u6d53\u6de1\uff0cV \u770b\u660e\u6697",
    "\u5feb\u6377\u952e\uff1a1 \u7ea2\u8272\u9884\u8bbe\uff0c2 \u7eff\u8272\u9884\u8bbe\uff0c3 \u84dd\u8272\u9884\u8bbe",
]
GUIDE_TITLE_EN = (
    "Chinese guide fallback: OpenCV trackbars on Windows often garble Chinese, "
    "so the sliders stay in short English and this window explains them."
)
GUIDE_LINES_EN = [
    "H low / H high: hue range. Roughly 0 red, 30 yellow, 60 green, 90 cyan, 120 blue, 150 purple.",
    "S low / S high: saturation range. Higher means purer color; lower means closer to gray/white.",
    "V low / V high: value range. Higher means brighter; lower means darker.",
    "Blur: smooth the image a bit before thresholding.",
    "Open: remove small white noise blobs.",
    "Close: fill small holes inside the detected region.",
    "Edge low / Edge high: Canny edge thresholds.",
    "Min area: ignore tiny false detections.",
    "HSV is not RGB: H is color type, S is richness, V is brightness.",
    "Shortcuts: 1 red preset, 2 green preset, 3 blue preset.",
]
GUIDE_FOOTER_ZH = "\u4e09\u539f\u8272 / RGB\uff1a\u7ea2(R) \u7eff(G) \u84dd(B)"
GUIDE_FOOTER_EN = "RGB primary colors: Red (R), Green (G), Blue (B)"


def noop(_: int) -> None:
    pass


def clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, int(value)))


def odd_kernel_from_slider(value: int) -> int:
    value = max(0, int(value))
    return 0 if value == 0 else value * 2 + 1


def load_guide_font(size: int) -> tuple[ImageFont.ImageFont, bool]:
    candidates = [
        Path(r"C:\Windows\Fonts\msyh.ttc"),
        Path(r"C:\Windows\Fonts\msyhbd.ttc"),
        Path(r"C:\Windows\Fonts\simhei.ttf"),
        Path(r"C:\Windows\Fonts\simsun.ttc"),
        Path(r"C:\Windows\Fonts\arialuni.ttf"),
    ]
    for font_path in candidates:
        if font_path.exists():
            return ImageFont.truetype(str(font_path), size=size), True
    return ImageFont.load_default(), False


def build_guide_panel() -> np.ndarray:
    panel_width = 980
    panel_height = 600
    image = Image.new("RGB", (panel_width, panel_height), (245, 247, 250))
    draw = ImageDraw.Draw(image)

    title_font, has_cjk_font = load_guide_font(26)
    body_font, _ = load_guide_font(20)
    footer_font, _ = load_guide_font(24)

    title_text = GUIDE_TITLE_ZH if has_cjk_font else GUIDE_TITLE_EN
    guide_lines = GUIDE_LINES_ZH if has_cjk_font else GUIDE_LINES_EN
    footer_text = GUIDE_FOOTER_ZH if has_cjk_font else GUIDE_FOOTER_EN

    draw.rounded_rectangle(
        (16, 16, panel_width - 16, panel_height - 16),
        radius=20,
        fill=(255, 255, 255),
        outline=(210, 216, 224),
        width=2,
    )
    draw.text((34, 30), title_text, fill=(24, 31, 42), font=title_font)

    y = 92
    for index, line in enumerate(guide_lines, start=1):
        draw.text((42, y), f"{index}. {line}", fill=(35, 40, 48), font=body_font)
        y += 42

    draw.text((42, panel_height - 128), footer_text, fill=(24, 31, 42), font=footer_font)

    chips = [
        ((220, 60, 60), "\u7ea2" if has_cjk_font else "Red"),
        ((60, 170, 80), "\u7eff" if has_cjk_font else "Green"),
        ((60, 110, 220), "\u84dd" if has_cjk_font else "Blue"),
    ]
    chip_x = 42
    for color, label in chips:
        draw.rounded_rectangle(
            (chip_x, panel_height - 84, chip_x + 120, panel_height - 36),
            radius=14,
            fill=color,
        )
        draw.text((chip_x + 40, panel_height - 74), label, fill=(255, 255, 255), font=body_font)
        chip_x += 150

    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


@dataclass
class ViewerConfig:
    low_h: int = 20
    high_h: int = 40
    low_s: int = 80
    high_s: int = 255
    low_v: int = 80
    high_v: int = 255
    blur: int = 2
    open_size: int = 2
    close_size: int = 3
    canny_low: int = 60
    canny_high: int = 160
    min_area: int = 800

    def normalized(self) -> "ViewerConfig":
        return ViewerConfig(
            low_h=clamp(self.low_h, 0, 179),
            high_h=clamp(self.high_h, 0, 179),
            low_s=clamp(self.low_s, 0, 255),
            high_s=clamp(self.high_s, 0, 255),
            low_v=clamp(self.low_v, 0, 255),
            high_v=clamp(self.high_v, 0, 255),
            blur=clamp(self.blur, 0, 15),
            open_size=clamp(self.open_size, 0, 15),
            close_size=clamp(self.close_size, 0, 15),
            canny_low=clamp(self.canny_low, 0, 255),
            canny_high=clamp(self.canny_high, 0, 255),
            min_area=clamp(self.min_area, 0, 500000),
        )


def color_preset(name: str) -> ViewerConfig:
    presets = {
        "red": ViewerConfig(low_h=170, high_h=10, low_s=80, high_s=255, low_v=80, high_v=255),
        "green": ViewerConfig(low_h=35, high_h=90, low_s=60, high_s=255, low_v=60, high_v=255),
        "blue": ViewerConfig(low_h=90, high_h=140, low_s=60, high_s=255, low_v=60, high_v=255),
    }
    return presets[name].normalized()


class ColorContourViewer:
    image_suffixes = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}

    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.default_config = ViewerConfig()
        self.config = self.default_config
        self.capture: cv2.VideoCapture | None = None
        self.screen_capture: object | None = None
        self.screen_region: dict[str, int] | None = None
        self.static_frame: np.ndarray | None = None
        self.last_frame: np.ndarray | None = None
        self.last_hsv: np.ndarray | None = None
        self.guide_panel = build_guide_panel()
        self.frame_width = 0
        self.frame_height = 0
        self.paused = False
        self.trackbars_ready = False
        self.save_path = Path(args.save)

        if args.config:
            self.config = self.load_config(Path(args.config))

        self.open_source()
        self.create_windows()
        self.sync_trackbars(self.config)
        print(WINDOW_CONSOLE_HINT)

    def open_source(self) -> None:
        if self.args.input:
            source_path = Path(self.args.input)
            if not source_path.exists():
                raise FileNotFoundError(f"Input path does not exist: {source_path}")

            if source_path.suffix.lower() in self.image_suffixes:
                frame = cv2.imread(str(source_path))
                if frame is None:
                    raise RuntimeError(f"Could not load image: {source_path}")
                self.static_frame = frame
                self.frame_height, self.frame_width = frame.shape[:2]
                return

            self.capture = cv2.VideoCapture(str(source_path))
            if not self.capture.isOpened():
                raise RuntimeError(f"Could not open video: {source_path}")
        else:
            self.open_screen_source()
            return

        ok, frame = self.capture.read()
        if not ok or frame is None:
            raise RuntimeError("Could not read the first frame from the source.")
        self.last_frame = frame
        self.frame_height, self.frame_width = frame.shape[:2]
        if self.args.input and self.static_frame is None:
            self.capture.set(cv2.CAP_PROP_POS_FRAMES, 0)

    def open_screen_source(self) -> None:
        self.screen_capture = mss.mss()
        monitors = self.screen_capture.monitors
        if len(monitors) <= 1:
            raise RuntimeError("No monitors were detected for screen capture.")

        max_monitor = len(monitors) - 1
        monitor_index = clamp(self.args.monitor, 1, max_monitor)
        monitor = monitors[monitor_index]

        left_offset = clamp(self.args.left, 0, max(0, monitor["width"] - 1))
        top_offset = clamp(self.args.top, 0, max(0, monitor["height"] - 1))
        available_width = max(1, monitor["width"] - left_offset)
        available_height = max(1, monitor["height"] - top_offset)
        capture_width = (
            available_width
            if self.args.width <= 0
            else clamp(self.args.width, 1, available_width)
        )
        capture_height = (
            available_height
            if self.args.height <= 0
            else clamp(self.args.height, 1, available_height)
        )

        self.screen_region = {
            "left": monitor["left"] + left_offset,
            "top": monitor["top"] + top_offset,
            "width": capture_width,
            "height": capture_height,
        }

        frame = self.grab_screen_frame()
        self.last_frame = frame
        self.frame_height, self.frame_width = frame.shape[:2]

    def grab_screen_frame(self) -> np.ndarray:
        if self.screen_capture is None or self.screen_region is None:
            raise RuntimeError("Screen capture is not initialized.")

        raw_frame = np.array(self.screen_capture.grab(self.screen_region), dtype=np.uint8)
        return cv2.cvtColor(raw_frame, cv2.COLOR_BGRA2BGR)

    def create_windows(self) -> None:
        cv2.namedWindow(WINDOW_DASHBOARD, cv2.WINDOW_NORMAL)
        cv2.namedWindow(WINDOW_CONTROLS, cv2.WINDOW_NORMAL)
        cv2.namedWindow(WINDOW_GUIDE, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(WINDOW_DASHBOARD, max(960, self.frame_width), max(720, self.frame_height))
        cv2.resizeWindow(WINDOW_GUIDE, self.guide_panel.shape[1], self.guide_panel.shape[0])

        cv2.createTrackbar(TRACKBAR_LOW_H, WINDOW_CONTROLS, 0, 179, noop)
        cv2.createTrackbar(TRACKBAR_HIGH_H, WINDOW_CONTROLS, 0, 179, noop)
        cv2.createTrackbar(TRACKBAR_LOW_S, WINDOW_CONTROLS, 0, 255, noop)
        cv2.createTrackbar(TRACKBAR_HIGH_S, WINDOW_CONTROLS, 0, 255, noop)
        cv2.createTrackbar(TRACKBAR_LOW_V, WINDOW_CONTROLS, 0, 255, noop)
        cv2.createTrackbar(TRACKBAR_HIGH_V, WINDOW_CONTROLS, 0, 255, noop)
        cv2.createTrackbar(TRACKBAR_BLUR, WINDOW_CONTROLS, 0, 15, noop)
        cv2.createTrackbar(TRACKBAR_OPEN, WINDOW_CONTROLS, 0, 15, noop)
        cv2.createTrackbar(TRACKBAR_CLOSE, WINDOW_CONTROLS, 0, 15, noop)
        cv2.createTrackbar(TRACKBAR_CANNY_LOW, WINDOW_CONTROLS, 0, 255, noop)
        cv2.createTrackbar(TRACKBAR_CANNY_HIGH, WINDOW_CONTROLS, 0, 255, noop)
        cv2.createTrackbar(TRACKBAR_MIN_AREA, WINDOW_CONTROLS, 0, 500000, noop)
        cv2.setMouseCallback(WINDOW_DASHBOARD, self.on_mouse)
        self.trackbars_ready = True

    def sync_trackbars(self, config: ViewerConfig) -> None:
        if not self.trackbars_ready:
            return

        config = config.normalized()
        cv2.setTrackbarPos(TRACKBAR_LOW_H, WINDOW_CONTROLS, config.low_h)
        cv2.setTrackbarPos(TRACKBAR_HIGH_H, WINDOW_CONTROLS, config.high_h)
        cv2.setTrackbarPos(TRACKBAR_LOW_S, WINDOW_CONTROLS, config.low_s)
        cv2.setTrackbarPos(TRACKBAR_HIGH_S, WINDOW_CONTROLS, config.high_s)
        cv2.setTrackbarPos(TRACKBAR_LOW_V, WINDOW_CONTROLS, config.low_v)
        cv2.setTrackbarPos(TRACKBAR_HIGH_V, WINDOW_CONTROLS, config.high_v)
        cv2.setTrackbarPos(TRACKBAR_BLUR, WINDOW_CONTROLS, config.blur)
        cv2.setTrackbarPos(TRACKBAR_OPEN, WINDOW_CONTROLS, config.open_size)
        cv2.setTrackbarPos(TRACKBAR_CLOSE, WINDOW_CONTROLS, config.close_size)
        cv2.setTrackbarPos(TRACKBAR_CANNY_LOW, WINDOW_CONTROLS, config.canny_low)
        cv2.setTrackbarPos(TRACKBAR_CANNY_HIGH, WINDOW_CONTROLS, config.canny_high)
        cv2.setTrackbarPos(TRACKBAR_MIN_AREA, WINDOW_CONTROLS, config.min_area)

    def read_config_from_trackbars(self) -> ViewerConfig:
        return ViewerConfig(
            low_h=cv2.getTrackbarPos(TRACKBAR_LOW_H, WINDOW_CONTROLS),
            high_h=cv2.getTrackbarPos(TRACKBAR_HIGH_H, WINDOW_CONTROLS),
            low_s=cv2.getTrackbarPos(TRACKBAR_LOW_S, WINDOW_CONTROLS),
            high_s=cv2.getTrackbarPos(TRACKBAR_HIGH_S, WINDOW_CONTROLS),
            low_v=cv2.getTrackbarPos(TRACKBAR_LOW_V, WINDOW_CONTROLS),
            high_v=cv2.getTrackbarPos(TRACKBAR_HIGH_V, WINDOW_CONTROLS),
            blur=cv2.getTrackbarPos(TRACKBAR_BLUR, WINDOW_CONTROLS),
            open_size=cv2.getTrackbarPos(TRACKBAR_OPEN, WINDOW_CONTROLS),
            close_size=cv2.getTrackbarPos(TRACKBAR_CLOSE, WINDOW_CONTROLS),
            canny_low=cv2.getTrackbarPos(TRACKBAR_CANNY_LOW, WINDOW_CONTROLS),
            canny_high=cv2.getTrackbarPos(TRACKBAR_CANNY_HIGH, WINDOW_CONTROLS),
            min_area=cv2.getTrackbarPos(TRACKBAR_MIN_AREA, WINDOW_CONTROLS),
        ).normalized()

    def load_config(self, path: Path) -> ViewerConfig:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
        return ViewerConfig(**data).normalized()

    def save_config(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as file:
            json.dump(asdict(self.config), file, indent=2)
        print(f"Saved config to {path}")

    def sample_hsv(self, x: int, y: int) -> None:
        if self.last_hsv is None:
            return
        if x < 0 or y < 0 or x >= self.frame_width or y >= self.frame_height:
            return

        pixel = self.last_hsv[y, x]
        hue, sat, val = (int(pixel[0]), int(pixel[1]), int(pixel[2]))

        hue_margin = clamp(self.args.sample_h_margin, 1, 90)
        sat_margin = clamp(self.args.sample_sv_margin, 1, 255)
        val_margin = clamp(self.args.sample_sv_margin, 1, 255)

        low_h = (hue - hue_margin) % 180
        high_h = (hue + hue_margin) % 180

        self.config = ViewerConfig(
            low_h=low_h,
            high_h=high_h,
            low_s=clamp(sat - sat_margin, 0, 255),
            high_s=clamp(sat + sat_margin, 0, 255),
            low_v=clamp(val - val_margin, 0, 255),
            high_v=clamp(val + val_margin, 0, 255),
            blur=self.config.blur,
            open_size=self.config.open_size,
            close_size=self.config.close_size,
            canny_low=self.config.canny_low,
            canny_high=self.config.canny_high,
            min_area=self.config.min_area,
        ).normalized()
        self.sync_trackbars(self.config)

    def on_mouse(self, event: int, x: int, y: int, _flags: int, _param: object) -> None:
        if event != cv2.EVENT_LBUTTONDOWN:
            return

        source_x = -1
        source_y = -1
        if x < self.frame_width and y < self.frame_height:
            source_x = x
            source_y = y
        elif x >= self.frame_width and y >= self.frame_height:
            source_x = x - self.frame_width
            source_y = y - self.frame_height

        if source_x >= 0 and source_y >= 0:
            self.sample_hsv(source_x, source_y)

    def next_frame(self) -> np.ndarray:
        if self.static_frame is not None:
            return self.static_frame.copy()

        if self.paused and self.last_frame is not None:
            return self.last_frame.copy()

        if self.screen_capture is not None:
            frame = self.grab_screen_frame()
            self.last_frame = frame
            return frame.copy()

        assert self.capture is not None
        ok, frame = self.capture.read()
        if not ok or frame is None:
            self.capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = self.capture.read()
            if not ok or frame is None:
                raise RuntimeError("Could not read a frame from the source.")
        self.last_frame = frame
        return frame.copy()

    @staticmethod
    def build_mask(hsv: np.ndarray, config: ViewerConfig) -> np.ndarray:
        lower_1 = np.array([config.low_h, config.low_s, config.low_v], dtype=np.uint8)
        upper_1 = np.array([config.high_h, config.high_s, config.high_v], dtype=np.uint8)

        if config.low_h <= config.high_h:
            return cv2.inRange(hsv, lower_1, upper_1)

        lower_2 = np.array([0, config.low_s, config.low_v], dtype=np.uint8)
        upper_2 = np.array([config.high_h, config.high_s, config.high_v], dtype=np.uint8)
        lower_3 = np.array([config.low_h, config.low_s, config.low_v], dtype=np.uint8)
        upper_3 = np.array([179, config.high_s, config.high_v], dtype=np.uint8)
        mask_low = cv2.inRange(hsv, lower_2, upper_2)
        mask_high = cv2.inRange(hsv, lower_3, upper_3)
        return cv2.bitwise_or(mask_low, mask_high)

    @staticmethod
    def apply_cleanup(mask: np.ndarray, config: ViewerConfig) -> np.ndarray:
        cleaned = mask
        open_kernel = odd_kernel_from_slider(config.open_size)
        close_kernel = odd_kernel_from_slider(config.close_size)

        if open_kernel > 0:
            kernel = cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE, (open_kernel, open_kernel)
            )
            cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)

        if close_kernel > 0:
            kernel = cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE, (close_kernel, close_kernel)
            )
            cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel)

        return cleaned

    @staticmethod
    def add_panel_label(image: np.ndarray, label: str) -> np.ndarray:
        output = image.copy()
        cv2.rectangle(output, (0, 0), (300, 34), (20, 20, 20), -1)
        cv2.putText(
            output,
            label,
            (12, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
        return output

    def analyze_frame(
        self, frame: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[np.ndarray]]:
        self.config = self.read_config_from_trackbars()

        blur_kernel = odd_kernel_from_slider(self.config.blur)
        processed = frame.copy()
        if blur_kernel > 0:
            processed = cv2.GaussianBlur(processed, (blur_kernel, blur_kernel), 0)

        hsv = cv2.cvtColor(processed, cv2.COLOR_BGR2HSV)
        self.last_hsv = hsv

        mask = self.build_mask(hsv, self.config)
        mask = self.apply_cleanup(mask, self.config)

        high = max(self.config.canny_low + 1, self.config.canny_high)
        edges = cv2.Canny(mask, self.config.canny_low, high)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        filtered = [
            contour
            for contour in contours
            if cv2.contourArea(contour) >= self.config.min_area
        ]

        overlay = frame.copy()
        largest = max(filtered, key=cv2.contourArea, default=None)
        for contour in filtered:
            area = cv2.contourArea(contour)
            x, y, w, h = cv2.boundingRect(contour)
            thickness = 3 if largest is contour else 2
            color = (0, 0, 255) if largest is contour else (0, 255, 0)
            cv2.drawContours(overlay, [contour], -1, color, thickness)
            cv2.rectangle(overlay, (x, y), (x + w, y + h), (255, 200, 0), 2)

            moments = cv2.moments(contour)
            if moments["m00"] > 0:
                center_x = int(moments["m10"] / moments["m00"])
                center_y = int(moments["m01"] / moments["m00"])
                cv2.circle(overlay, (center_x, center_y), 4, (255, 255, 255), -1)
                cv2.putText(
                    overlay,
                    f"{int(area)}",
                    (x, max(20, y - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA,
                )

        return overlay, mask, edges, filtered

    def build_dashboard(
        self,
        source: np.ndarray,
        overlay: np.ndarray,
        mask: np.ndarray,
        edges: np.ndarray,
        contours: list[np.ndarray],
    ) -> np.ndarray:
        mask_bgr = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
        edges_bgr = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)

        source_panel = self.add_panel_label(source, "Source")
        mask_panel = self.add_panel_label(mask_bgr, "Mask")
        edges_panel = self.add_panel_label(edges_bgr, "Edges")
        overlay_panel = self.add_panel_label(overlay, "Contours")

        dashboard = np.vstack(
            [
                np.hstack([source_panel, mask_panel]),
                np.hstack([edges_panel, overlay_panel]),
            ]
        )

        coverage = 100.0 * cv2.countNonZero(mask) / mask.size
        info_lines = [
            f"Contours: {len(contours)} | Coverage: {coverage:.2f}%",
            (
                f"H:{self.config.low_h}-{self.config.high_h} "
                f"S:{self.config.low_s}-{self.config.high_s} "
                f"V:{self.config.low_v}-{self.config.high_v}"
            ),
            (
                "Keys: q/ESC quit | space pause | s save | r reset | "
                "1 red 2 green 3 blue | click Source/Contours to sample"
            ),
            "See the 'Chinese Guide' window for the Chinese explanations.",
        ]

        text_y = 34
        for line in info_lines:
            cv2.putText(
                dashboard,
                line,
                (16, text_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.72,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )
            text_y += 30

        return dashboard

    def run(self) -> None:
        while True:
            frame = self.next_frame()
            overlay, mask, edges, contours = self.analyze_frame(frame)
            dashboard = self.build_dashboard(frame, overlay, mask, edges, contours)
            cv2.imshow(WINDOW_DASHBOARD, dashboard)
            cv2.imshow(WINDOW_GUIDE, self.guide_panel)

            key = cv2.waitKey(1 if self.static_frame is None else 30) & 0xFF
            if key in (27, ord("q")):
                break
            if key == ord(" "):
                self.paused = not self.paused
            if key == ord("s"):
                self.save_config(self.save_path)
            if key == ord("r"):
                self.config = self.default_config
                self.sync_trackbars(self.config)
            if key == ord("1"):
                self.config = color_preset("red")
                self.sync_trackbars(self.config)
            if key == ord("2"):
                self.config = color_preset("green")
                self.sync_trackbars(self.config)
            if key == ord("3"):
                self.config = color_preset("blue")
                self.sync_trackbars(self.config)

        if self.capture is not None:
            self.capture.release()
        if self.screen_capture is not None and hasattr(self.screen_capture, "close"):
            self.screen_capture.close()
        cv2.destroyAllWindows()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Real-time HSV color extraction and contour viewer."
    )
    parser.add_argument(
        "--input",
        type=str,
        default="",
        help="Optional image/video path. Leave empty to capture the screen.",
    )
    parser.add_argument(
        "--monitor",
        type=int,
        default=1,
        help="Monitor index for screen capture when --input is not used.",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=0,
        help="Screen capture width. 0 means capture to the monitor edge.",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=0,
        help="Screen capture height. 0 means capture to the monitor edge.",
    )
    parser.add_argument(
        "--left",
        type=int,
        default=0,
        help="Left offset inside the selected monitor for screen capture.",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=0,
        help="Top offset inside the selected monitor for screen capture.",
    )
    parser.add_argument(
        "--config",
        type=str,
        default="",
        help="Optional JSON config file to preload HSV parameters.",
    )
    parser.add_argument(
        "--save",
        type=str,
        default="saved_hsv_config.json",
        help="Where to save the current slider values when pressing s.",
    )
    parser.add_argument(
        "--sample-h-margin",
        type=int,
        default=12,
        help="Hue tolerance used when sampling a color with the mouse.",
    )
    parser.add_argument(
        "--sample-sv-margin",
        type=int,
        default=60,
        help="S/V tolerance used when sampling a color with the mouse.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        viewer = ColorContourViewer(args)
        viewer.run()
    except Exception as exc:
        print(f"Error: {exc}")


if __name__ == "__main__":
    main()
