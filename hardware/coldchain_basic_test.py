import time
import machine
from ahtx0 import AHT20
from lis2dh12 import LIS2DH12

print("ColdChain basic monitor start")

# I2C
i2c = machine.I2C(1, freq=400000)

# Sensors
aht = AHT20(i2c)
gsensor = LIS2DH12(i2c)
ldr = machine.ADC(machine.Pin('C5'))

# 当前先用测试阈值，方便室内测试
TEMP_LOW = 20
TEMP_HIGH = 30

# 你刚刚标定出来的开箱阈值
OPEN_THRESHOLD = 38000

# 震动阈值：越小越敏感，先用 4.0 测试
SHOCK_THRESHOLD = 4.0

while True:
    try:
        temperature = aht.temperature
        humidity = aht.relative_humidity

        light_raw = ldr.read_u16()

        acc = gsensor.acceleration
        x = acc.x
        y = acc.y
        z = acc.z

        # 加速度模长，静止时大约接近 9.8
        acc_total = (x * x + y * y + z * z) ** 0.5

        # 状态判断
        if temperature < TEMP_LOW or temperature > TEMP_HIGH:
            temp_status = "TEMP_ALERT"
        else:
            temp_status = "TEMP_OK"

        if light_raw < OPEN_THRESHOLD:
            box_status = "BOX_OPEN"
        else:
            box_status = "BOX_CLOSED"

        if abs(acc_total - 9.8) > SHOCK_THRESHOLD:
            shock_status = "SHOCK"
        else:
            shock_status = "STABLE"

        print("temperature:", temperature)
        print("humidity:", humidity)
        print("light:", light_raw, box_status)
        print("acc:", x, y, z, "total:", acc_total, shock_status)
        print("status:", temp_status, box_status, shock_status)
        print("------------------------------")

    except Exception as e:
        print("error:", e)

    time.sleep(2)