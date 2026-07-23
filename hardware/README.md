# UniKnect 硬件端

本目录保存 UniKnect Kit GEN-1 Pro 的 MicroPython 程序，包含传感器、LCD、4G 联网和冷链数据上传测试。

## 推荐运行顺序

1. `i2c_scan.py`：确认 I2C 设备可以被扫描。
2. `sensor_test.py`、`light_test.py`、`box_open_test.py`：测试传感器和开箱判断。
3. `lcd_test.py`、`coldchain_lcd_demo.py`：测试 LCD。
4. `network_test.py`、`http_get_test.py`、`http_post_test.py`：测试 4G 和 HTTP。
5. `coldchain_realtime_local.py`：验证本地实时采集和显示。
6. `backend_post_test.py`：验证后端可以接收 JSON。
7. `coldchain_upload_demo.py`：运行完整的采集、显示和 4G 上传演示。

## 配置后端地址

仓库不会提交真实运行地址，避免把临时隧道或正式服务器配置写死在代码中。

1. 将 `config.py.example` 复制为 `config.py`。
2. 把 `SERVER_URL` 改为当前后端的完整上传接口，例如：

```python
SERVER_URL = "https://your-domain.example/api/device/data"
```

3. 在 Thonny 中把 `config.py` 与需要运行的脚本一起保存到开发板。

`config.py` 已加入 `.gitignore`，不会被提交到 GitHub。

## 演示注意事项

- SIM 卡插入 USIM1，并确认 4G 主天线连接 MAIN_ANT。
- 先启动后端，再运行硬件上传程序。
- `coldchain_upload_demo.py` 保留当前已经调好的运动阈值和 LCD 逻辑。
- 服务器应使用稳定的 HTTPS 域名；Cloudflare Quick Tunnel 只适合临时联调。
- Thonny Shell 持续打印传感器数据和 `upload status` 时，才表示程序仍在运行。
