import machine
import time
from st7735 import LCD

print("LCD test start")

spi = machine.SPI(1, baudrate=10000000, polarity=0, phase=0)

lcd = LCD(spi, dc_pin="F12", cs_pin="D14")
lcd.set_rotation(3)

lcd.fill_screen(lcd.BLACK)

lcd.show_string(0, 5, "ColdChain IoT", lcd.CYAN, lcd.BLACK, 16)
lcd.show_string(0, 30, "LCD OK", lcd.YELLOW, lcd.BLACK, 16)
lcd.show_string(0, 55, "Temp: 26.4C", lcd.WHITE, lcd.BLACK, 16)
lcd.show_string(0, 80, "Box: OPEN", lcd.GREEN, lcd.BLACK, 16)
lcd.show_string(0, 105, "Move: STABLE", lcd.GREEN, lcd.BLACK, 16)

lcd.flush()

print("LCD test done")