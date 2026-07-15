import time
import machine

from ahtx0 import AHT20
from lis2dh12 import LIS2DH12
from st7735 import LCD


print("ColdChain realtime local demo start")


# =========================================================
# 1. 阈值配置
# =========================================================

# 当前室内测试温度阈值
# 后期真实冷链可以改成 2~8
TEMP_LOW = 20
TEMP_HIGH = 30

# 光敏开箱阈值
# 你的光敏规律：暗处 raw 高，亮处 raw 低
# 正常室内大约 18000~25000
# 遮住/关灯大约 59000~60000
# 所以 raw < 40000 判定为开箱，raw >= 40000 判定为关闭
OPEN_THRESHOLD = 40000

# 加速度阈值
# 静止时 acc_total 大约 9.8
FREE_FALL_THRESHOLD = 7.0       # 明显小于 9.8，疑似自由落体
IMPACT_ACC_THRESHOLD = 16.0     # 明显大于 9.8，疑似冲击

# 运动分级阈值
# 当前版本避免静止误判 MILD
MILD_DELTA = 0.80       # 轻微晃动
SEVERE_DELTA = 2.50     # 剧烈晃动
IMPACT_DELTA = 6.00     # 猛烈撞击/冲击

# 每轮循环间隔
LOOP_DELAY = 0.10

# 每轮内部采样次数
# 之前 8 次太敏感，现在改成 5 次降低静止误判
SAMPLE_COUNT = 5

# 每次采样间隔
SAMPLE_DELAY = 0.03


# =========================================================
# 2. 硬件初始化
# =========================================================

i2c = machine.I2C(1, freq=400000)

aht = AHT20(i2c)
gsensor = LIS2DH12(i2c)

# 光敏传感器 ADC
ldr = machine.ADC(machine.Pin("C5"))

# LCD
spi = machine.SPI(1, baudrate=10000000, polarity=0, phase=0)
lcd = LCD(spi, dc_pin="F12", cs_pin="D14")
lcd.set_rotation(3)
lcd.fill_screen(lcd.BLACK)
lcd.flush()


# =========================================================
# 3. 状态判断函数
# =========================================================

def get_temp_status(temp):
    if temp < TEMP_LOW or temp > TEMP_HIGH:
        return "TEMP_ALERT"
    return "TEMP_OK"


def get_box_status(light_raw):
    # 暗高亮低：有光进入时 raw 低，判定为开箱
    if light_raw < OPEN_THRESHOLD:
        return "BOX_OPEN"
    return "BOX_CLOSED"


def get_acc_sample():
    acc = gsensor.acceleration
    x = acc.x
    y = acc.y
    z = acc.z
    acc_total = (x * x + y * y + z * z) ** 0.5
    return x, y, z, acc_total


def get_move_status():
    """
    在一小段时间内采样多次，计算窗口内变化量。
    这版阈值提高，避免静止时误判为 MILD。
    """

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

    # 窗口内最大最小差值
    range_score = (
        (max(x_list) - min(x_list)) +
        (max(y_list) - min(y_list)) +
        (max(z_list) - min(z_list))
    )

    # 相邻两次最大变化量
    max_step_delta = 0

    for i in range(1, len(x_list)):
        dx = abs(x_list[i] - x_list[i - 1])
        dy = abs(y_list[i] - y_list[i - 1])
        dz = abs(z_list[i] - z_list[i - 1])

        step_delta = dx + dy + dz

        if step_delta > max_step_delta:
            max_step_delta = step_delta

    # 取较大值作为运动强度
    motion_delta = max(range_score, max_step_delta)

    min_acc_total = min(acc_total_list)
    max_acc_total = max(acc_total_list)

    # 判断优先级：
    # 1. 自由落体：合加速度明显低于 9.8
    # 2. 撞击：合加速度很高，或变化量很大
    # 3. 剧烈晃动
    # 4. 轻微晃动
    # 5. 稳定
    if min_acc_total < FREE_FALL_THRESHOLD:
        move_status = "FREE_FALL"
    elif max_acc_total > IMPACT_ACC_THRESHOLD or motion_delta >= IMPACT_DELTA:
        move_status = "IMPACT"
    elif motion_delta >= SEVERE_DELTA:
        move_status = "SEVERE"
    elif motion_delta >= MILD_DELTA:
        move_status = "MILD"
    else:
        move_status = "STABLE"

    return move_status, motion_delta, min_acc_total, max_acc_total


# =========================================================
# 4. LCD 显示
# =========================================================

def draw_screen(temp, humi, light_raw, box_status, move_status, temp_status, motion_delta):
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

    lcd.flush()


# =========================================================
# 5. 主循环
# =========================================================

while True:
    try:
        temperature = aht.temperature
        humidity = aht.relative_humidity

        light_raw = ldr.read_u16()

        temp_status = get_temp_status(temperature)
        box_status = get_box_status(light_raw)

        move_status, motion_delta, min_acc_total, max_acc_total = get_move_status()

        print("temperature:", temperature)
        print("humidity:", humidity)
        print("light_raw:", light_raw, box_status)
        print("motion_delta:", motion_delta)
        print("min_acc_total:", min_acc_total)
        print("max_acc_total:", max_acc_total)
        print("status:", temp_status, box_status, move_status)
        print("------------------------------")

        draw_screen(
            temperature,
            humidity,
            light_raw,
            box_status,
            move_status,
            temp_status,
            motion_delta
        )

    except Exception as e:
        print("main loop error:", e)

    time.sleep(LOOP_DELAY)