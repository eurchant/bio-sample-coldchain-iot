import time
import machine
from ahtx0 import AHT20
from lis2dh12 import LIS2DH12
from st7735 import LCD

print("ColdChain LCD demo start")

# =========================
# 1. 传感器初始化
# =========================

# I2C：温湿度传感器 AHT20、三轴加速度 LIS2DH12
i2c = machine.I2C(1, freq=400000)
aht = AHT20(i2c)
gsensor = LIS2DH12(i2c)

# 光敏传感器：用于模拟开箱检测
# 你前面测试结果：暗处 raw 高，亮处 raw 低
ldr = machine.ADC(machine.Pin("C5"))

# =========================
# 2. LCD 初始化
# =========================

spi = machine.SPI(1, baudrate=10000000, polarity=0, phase=0)

lcd = LCD(spi, dc_pin="F12", cs_pin="D14")
lcd.set_rotation(3)
lcd.fill_screen(lcd.BLACK)
lcd.flush()

# =========================
# 3. 阈值配置
# =========================

# 温度阈值：现在先用室内测试阈值
# 后面做真实冷链箱时，可以改成 2~8 摄氏度
TEMP_LOW = 20
TEMP_HIGH = 30

# 开箱阈值：根据你刚才实测
# 关灯/遮住 raw 约 60000
# 正常室内 raw 约 16000
# 所以 raw < 38000 判定为有光进入，即疑似开箱
OPEN_THRESHOLD = 38000

# 多级震动阈值
# shock_value = 本次 x/y/z 与上一次 x/y/z 的变化量之和
MILD_THRESHOLD = 0.6
SEVERE_THRESHOLD = 1.8
IMPACT_THRESHOLD = 4.0

# 自由落体辅助判断
# acc_total 静止时约 9.8
# 如果瞬间接近 0，可能是疑似跌落过程
FREE_FALL_THRESHOLD = 3.0

# 记录上一次加速度
last_x = None
last_y = None
last_z = None


# =========================
# 4. 状态判断函数
# =========================

def get_temp_status(temp):
    if temp < TEMP_LOW or temp > TEMP_HIGH:
        return "TEMP_ALERT"
    return "TEMP_OK"


def get_box_status(light_raw):
    # 当前光敏电路：暗高亮低
    if light_raw < OPEN_THRESHOLD:
        return "BOX_OPEN"
    return "BOX_CLOSED"


def get_move_status(x, y, z):
    global last_x, last_y, last_z

    acc_total = (x * x + y * y + z * z) ** 0.5

    if last_x is None:
        shock_value = 0
        move_status = "STABLE"
    else:
        dx = abs(x - last_x)
        dy = abs(y - last_y)
        dz = abs(z - last_z)

        shock_value = dx + dy + dz

        if acc_total < FREE_FALL_THRESHOLD:
            move_status = "FREE_FALL"
        elif shock_value < MILD_THRESHOLD:
            move_status = "STABLE"
        elif shock_value < SEVERE_THRESHOLD:
            move_status = "MILD"
        elif shock_value < IMPACT_THRESHOLD:
            move_status = "SEVERE"
        else:
            move_status = "IMPACT"

    last_x = x
    last_y = y
    last_z = z

    return move_status, shock_value, acc_total


# =========================
# 5. LCD 显示函数
# =========================

def draw_screen(temp, humi, light_raw, box_status, move_status, shock_value, temp_status):
    lcd.fill_screen(lcd.BLACK)

    # 标题
    lcd.show_string(0, 5, "ColdChain IoT", lcd.CYAN, lcd.BLACK, 16)

    # 温湿度
    lcd.show_string(0, 28, "Temp: %.1f C" % temp, lcd.WHITE, lcd.BLACK, 16)
    lcd.show_string(0, 48, "Humi: %.1f %%" % humi, lcd.WHITE, lcd.BLACK, 16)

    # 开箱状态颜色
    if box_status == "BOX_OPEN":
        box_color = lcd.RED
    else:
        box_color = lcd.GREEN

    # 震动状态颜色
    if move_status == "STABLE":
        move_color = lcd.GREEN
    elif move_status == "MILD":
        move_color = lcd.YELLOW
    elif move_status == "SEVERE":
        move_color = lcd.RED
    elif move_status == "IMPACT":
        move_color = lcd.RED
    elif move_status == "FREE_FALL":
        move_color = lcd.RED
    else:
        move_color = lcd.WHITE

    # 温度状态颜色
    if temp_status == "TEMP_ALERT":
        temp_color = lcd.RED
    else:
        temp_color = lcd.GREEN

    # 状态显示
    lcd.show_string(0, 72, "Box: " + box_status, box_color, lcd.BLACK, 16)
    lcd.show_string(0, 92, "Move: " + move_status, move_color, lcd.BLACK, 16)
    lcd.show_string(0, 112, "Temp: " + temp_status, temp_color, lcd.BLACK, 16)

    lcd.flush()


# =========================
# 6. 主循环
# =========================

while True:
    try:
        # 读取温湿度
        temperature = aht.temperature
        humidity = aht.relative_humidity

        # 读取光敏
        light_raw = ldr.read_u16()

        # 读取三轴加速度
        acc = gsensor.acceleration
        x = acc.x
        y = acc.y
        z = acc.z

        # 状态判断
        temp_status = get_temp_status(temperature)
        box_status = get_box_status(light_raw)
        move_status, shock_value, acc_total = get_move_status(x, y, z)

        # 串口输出，方便你调试
        print("temperature:", temperature)
        print("humidity:", humidity)
        print("light:", light_raw, box_status)
        print("acc:", x, y, z)
        print("acc_total:", acc_total)
        print("shock_value:", shock_value)
        print("status:", temp_status, box_status, move_status)
        print("------------------------------")

        # LCD 显示
        draw_screen(
            temperature,
            humidity,
            light_raw,
            box_status,
            move_status,
            shock_value,
            temp_status
        )

    except Exception as e:
        print("error:", e)

    time.sleep(0.5)