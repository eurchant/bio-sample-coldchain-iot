import time
import machine
import gc

try:
    import ujson as json
except Exception:
    import json

import urequests

try:
    import usocket as socket
except Exception:
    import socket

try:
    socket.setdefaulttimeout(5)
except Exception:
    pass

from quectel import Network

from ahtx0 import AHT20
from lis2dh12 import LIS2DH12
from st7735 import LCD

try:
    from config import SERVER_URL
except ImportError:
    raise ImportError("Please create config.py from config.py.example")


print("ColdChain upload demo start")


# =========================================================
# 1. Basic config
# =========================================================

DEVICE_ID = "CLD-001"
TASK_ID = "TASK-001"

# 5 秒上传一次，避免 4G + HTTPS 频繁阻塞
UPLOAD_INTERVAL_MS = 5000

# LCD 每 0.4 秒刷新一次
LCD_REFRESH_INTERVAL_MS = 400

# 主循环间隔
LOOP_DELAY = 0.10


# =========================================================
# 2. Threshold config
# =========================================================

# 演示温度阈值
# 后期真实生物样本冷链可以改为 2~8
TEMP_LOW = 20
TEMP_HIGH = 30

# 光敏规律：
# 暗处 raw 高，亮处 raw 低
# raw 低：有光进入，开箱
# raw 高：遮光/关灯，关闭
OPEN_THRESHOLD = 40000

# 开箱判断加入迟滞，避免临界值附近来回跳
BOX_OPEN_THRESHOLD = 35000
BOX_CLOSE_THRESHOLD = 45000

# 加速度阈值
FREE_FALL_THRESHOLD = 6.5
IMPACT_ACC_THRESHOLD = 18.0

# 运动阈值，使用欧氏变化量
# 这组比之前更稳，轻微动作不容易直接变 SEVERE
MILD_DELTA = 1.40
SEVERE_DELTA = 4.50
IMPACT_DELTA = 9.00

# 加速度采样参数
SAMPLE_COUNT = 5
SAMPLE_DELAY = 0.03


# =========================================================
# 3. Hardware init
# =========================================================

i2c = machine.I2C(1, freq=400000)

aht = AHT20(i2c)
gsensor = LIS2DH12(i2c)

ldr = machine.ADC(machine.Pin("C5"))

spi = machine.SPI(1, baudrate=10000000, polarity=0, phase=0)
lcd = LCD(spi, dc_pin="F12", cs_pin="D14")
lcd.set_rotation(3)
lcd.fill_screen(lcd.BLACK)
lcd.flush()


# =========================================================
# 4. Network init
# =========================================================

net = None
network_ready = False
last_network_retry_ms = 0
NETWORK_RETRY_INTERVAL_MS = 30000


def init_network():
    global net

    print("init network...")

    try:
        net = Network()
        net.init()

        try:
            net.query_usim()
            print("sim ok")
        except Exception as e:
            print("query sim error:", e)

        net.attach()
        time.sleep(1)

        try:
            if net.is_connected():
                print("network connected")
                return True
        except Exception as e:
            print("is_connected error:", e)

        print("network attach finished")
        return True

    except Exception as e:
        print("network init error:", e)
        return False


network_ready = init_network()
last_network_retry_ms = time.ticks_ms()


# =========================================================
# 5. Status functions
# =========================================================

box_status_cache = None


def get_temp_status(temp):
    if temp < TEMP_LOW or temp > TEMP_HIGH:
        return "TEMP_ALERT"
    return "TEMP_OK"


def get_box_status(light_raw):
    """
    开箱状态迟滞判断：
    - light_raw < 35000：明确开箱
    - light_raw > 45000：明确关闭
    - 35000~45000：保持上一次状态
    """

    global box_status_cache

    if box_status_cache is None:
        if light_raw < OPEN_THRESHOLD:
            box_status_cache = "BOX_OPEN"
        else:
            box_status_cache = "BOX_CLOSED"
        return box_status_cache

    if light_raw < BOX_OPEN_THRESHOLD:
        box_status_cache = "BOX_OPEN"
    elif light_raw > BOX_CLOSE_THRESHOLD:
        box_status_cache = "BOX_CLOSED"

    return box_status_cache


def get_acc_sample():
    acc = gsensor.acceleration
    x = acc.x
    y = acc.y
    z = acc.z
    acc_total = (x * x + y * y + z * z) ** 0.5
    return x, y, z, acc_total


def get_motion_priority(status):
    if status == "STABLE":
        return 0
    if status == "MILD":
        return 1
    if status == "SEVERE":
        return 2
    if status == "IMPACT":
        return 3
    if status == "FREE_FALL":
        return 4
    return 0


def get_hold_time_ms(status):
    if status == "MILD":
        return 1000
    if status == "SEVERE":
        return 1600
    if status == "IMPACT":
        return 2500
    if status == "FREE_FALL":
        return 2500
    return 0


def get_move_status_raw():
    x_list = []
    y_list = []
    z_list = []
    acc_total_list = []

    for i in range(SAMPLE_COUNT):
        x, y, z, acc_total = get_acc_sample()

        x_list.append(x)
        y_list.append(y)
        z_list.append(z)
        acc_total_list.append(acc_total)

        time.sleep(SAMPLE_DELAY)

    # 窗口内最大变化量，使用欧氏距离
    x_range = max(x_list) - min(x_list)
    y_range = max(y_list) - min(y_list)
    z_range = max(z_list) - min(z_list)

    range_score = (x_range * x_range + y_range * y_range + z_range * z_range) ** 0.5

    # 相邻两次最大变化量，使用欧氏距离
    max_step_score = 0

    for i in range(1, len(x_list)):
        dx = x_list[i] - x_list[i - 1]
        dy = y_list[i] - y_list[i - 1]
        dz = z_list[i] - z_list[i - 1]

        step_score = (dx * dx + dy * dy + dz * dz) ** 0.5

        if step_score > max_step_score:
            max_step_score = step_score

    motion_score = max(range_score, max_step_score)

    min_acc_total = min(acc_total_list)
    max_acc_total = max(acc_total_list)

    if min_acc_total < FREE_FALL_THRESHOLD:
        move_status = "FREE_FALL"
    elif max_acc_total > IMPACT_ACC_THRESHOLD or motion_score >= IMPACT_DELTA:
        move_status = "IMPACT"
    elif motion_score >= SEVERE_DELTA:
        move_status = "SEVERE"
    elif motion_score >= MILD_DELTA:
        move_status = "MILD"
    else:
        move_status = "STABLE"

    return move_status, motion_score, min_acc_total, max_acc_total


# =========================================================
# 6. Motion hold logic
# =========================================================

held_move_status = "STABLE"
held_motion_score = 0
held_acc_total = 9.8
held_until_ms = 0


def apply_motion_hold(raw_status, raw_score, max_acc_total):
    global held_move_status
    global held_motion_score
    global held_acc_total
    global held_until_ms

    now = time.ticks_ms()

    if raw_status != "STABLE":
        raw_priority = get_motion_priority(raw_status)
        held_priority = get_motion_priority(held_move_status)

        if raw_priority >= held_priority or time.ticks_diff(now, held_until_ms) > 0:
            held_move_status = raw_status
            held_motion_score = raw_score
            held_acc_total = max_acc_total
            held_until_ms = time.ticks_add(now, get_hold_time_ms(raw_status))

    if time.ticks_diff(held_until_ms, now) > 0:
        return held_move_status, held_motion_score, held_acc_total

    held_move_status = "STABLE"
    held_motion_score = raw_score
    held_acc_total = max_acc_total

    return "STABLE", raw_score, max_acc_total


# =========================================================
# 7. LCD display
# =========================================================

def draw_screen(temp, humi, light_raw, box_status, move_status, temp_status, motion_score, uploading):
    lcd.fill_screen(lcd.BLACK)

    lcd.show_string(0, 5, "ColdChain IoT", lcd.CYAN, lcd.BLACK, 16)

    lcd.show_string(0, 28, "T: %.1f C" % temp, lcd.WHITE, lcd.BLACK, 16)
    lcd.show_string(0, 48, "H: %.1f %%" % humi, lcd.WHITE, lcd.BLACK, 16)

    if box_status == "BOX_OPEN":
        box_text = "OPEN"
        box_color = lcd.RED
    else:
        box_text = "CLOSED"
        box_color = lcd.GREEN

    if move_status == "STABLE":
        move_color = lcd.GREEN
    elif move_status == "MILD":
        move_color = lcd.YELLOW
    elif move_status == "SEVERE":
        move_color = lcd.YELLOW
    else:
        move_color = lcd.RED

    if temp_status == "TEMP_ALERT":
        temp_text = "ALERT"
        temp_color = lcd.RED
    else:
        temp_text = "OK"
        temp_color = lcd.GREEN

    lcd.show_string(0, 70, "Box: " + box_text, box_color, lcd.BLACK, 16)
    lcd.show_string(0, 90, "Move: " + move_status, move_color, lcd.BLACK, 16)
    lcd.show_string(0, 110, "Temp: " + temp_text, temp_color, lcd.BLACK, 16)

    if uploading:
        lcd.show_string(102, 5, "UP", lcd.YELLOW, lcd.BLACK, 16)

    lcd.flush()


# =========================================================
# 8. Upload function
# =========================================================

def upload_data(payload):
    global network_ready

    if not network_ready:
        print("skip upload: network not ready")
        return False

    response = None

    try:
        body = json.dumps(payload)

        headers = {
            "Content-Type": "application/json"
        }

        print("upload begin")

        response = urequests.post(
            SERVER_URL,
            data=body,
            headers=headers
        )

        print("upload end")

        status_code = response.status_code
        print("upload status:", status_code)

        try:
            response.close()
        except Exception:
            pass

        gc.collect()

        if status_code >= 200 and status_code < 300:
            return True

        return False

    except Exception as e:
        print("upload error:", e)

        try:
            if response:
                response.close()
        except Exception:
            pass

        network_ready = False
        gc.collect()
        return False


# =========================================================
# 9. Main loop
# =========================================================

last_upload_ms = time.ticks_ms()
last_lcd_ms = time.ticks_ms()
first_upload = True

while True:
    try:
        now = time.ticks_ms()

        # 如果网络失败，不要一直重连；30 秒后再试
        if not network_ready:
            if time.ticks_diff(now, last_network_retry_ms) >= NETWORK_RETRY_INTERVAL_MS:
                last_network_retry_ms = now
                network_ready = init_network()

        temperature = aht.temperature
        humidity = aht.relative_humidity

        light_raw = ldr.read_u16()

        temp_status = get_temp_status(temperature)
        box_status = get_box_status(light_raw)

        raw_move_status, raw_motion_score, min_acc_total, max_acc_total = get_move_status_raw()

        move_status, motion_score, acc_total_for_upload = apply_motion_hold(
            raw_move_status,
            raw_motion_score,
            max_acc_total
        )

        print("temperature:", temperature)
        print("humidity:", humidity)
        print("light_raw:", light_raw, box_status)
        print("raw_move_status:", raw_move_status)
        print("move_status:", move_status)
        print("motion_score:", motion_score)
        print("min_acc_total:", min_acc_total)
        print("max_acc_total:", max_acc_total)
        print("status:", temp_status, box_status, move_status)
        print("------------------------------")

        periodic_due = time.ticks_diff(now, last_upload_ms) >= UPLOAD_INTERVAL_MS

        should_upload = False

        if first_upload:
            should_upload = True
        elif periodic_due:
            should_upload = True

        lcd_due = time.ticks_diff(now, last_lcd_ms) >= LCD_REFRESH_INTERVAL_MS

        # LCD 优先刷新。如果马上要上传，也先刷新一次，避免上传时屏幕停在旧状态
        if lcd_due or should_upload:
            draw_screen(
                temperature,
                humidity,
                light_raw,
                box_status,
                move_status,
                temp_status,
                motion_score,
                should_upload
            )
            last_lcd_ms = time.ticks_ms()

        if should_upload:
            payload = {
                "device_id": DEVICE_ID,
                "task_id": TASK_ID,
                "temperature": round(temperature, 2),
                "humidity": round(humidity, 2),
                "light_raw": light_raw,
                "box_status": box_status,
                "move_status": move_status,
                "temp_status": temp_status,
                "acc_total": round(acc_total_for_upload, 2),
                "motion_score": round(motion_score, 2)
            }

            upload_ok = upload_data(payload)

            last_upload_ms = time.ticks_ms()

            if upload_ok:
                first_upload = False
            else:
                # 上传失败时也不要立刻重试，避免连续卡住
                first_upload = False

    except Exception as e:
        print("main loop error:", e)
        gc.collect()

    time.sleep(LOOP_DELAY)
