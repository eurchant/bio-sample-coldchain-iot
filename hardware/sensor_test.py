import time
import machine
from ahtx0 import AHT20
from lis2dh12 import LIS2DH12

print("ColdChain sensor test start")

# I2C 初始化，具体引脚如果官方文档不同，后面再按文档改
i2c = machine.I2C(1)

# 温湿度传感器
aht = AHT20(i2c)

# 三轴加速度传感器
gsensor = LIS2DH12(i2c)

while True:
    try:
        temperature = aht.temperature
        humidity = aht.relative_humidity

        acc = gsensor.acceleration

        print("temperature:", temperature)
        print("humidity:", humidity)
        print("acceleration:", acc)
        print("--------------------")

    except Exception as e:
        print("sensor error:", e)

    time.sleep(2)