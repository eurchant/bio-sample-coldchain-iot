# network_test.py
# UniKnect Kit GEN-1 Pro 4G基础联网测试
# 只测试4G网络是否可用，不包含冷链项目代码

import time
import urequests
from quectel import Network


TEST_URL = "http://example.com/"


def main():
    print("=== UniKnect 4G network test start ===")

    net = Network()

    try:
        print("[1] 初始化4G网络模块...")
        if net.init():
            print("    OK: 网络模块初始化成功")
        else:
            print("    FAIL: 网络模块初始化失败")
            return

        print("[2] 检查SIM卡状态...")
        if net.query_usim():
            print("    OK: SIM卡正常")
        else:
            print("    FAIL: SIM卡异常，请检查SIM卡、USIM1卡槽、SIM选择开关S501")
            return

        print("[3] 注册/附着蜂窝网络...")
        try:
            net.attach()
            print("    OK: attach调用完成")
        except OSError as e:
            print("    FAIL: 蜂窝网络附着失败:", e)
            print("    建议检查：天线、SIM卡流量、信号、S501是否切到USIM1")
            return

        print("[4] 等待网络连接状态...")
        connected = False
        for i in range(30):
            if net.is_connected():
                connected = True
                print("    OK: 网络已连接")
                break
            print("    等待联网... {}s".format(i + 1))
            time.sleep(1)

        if not connected:
            print("    FAIL: 30秒内未连接到网络")
            return

        print("[5] 发起HTTP GET测试...")
        print("    URL:", TEST_URL)

        response = None
        try:
            response = urequests.get(TEST_URL)
            print("    HTTP状态码:", response.status_code)
            print("    返回内容:", response.text)

            if response.status_code == 200:
                print("    OK: 4G联网成功，HTTP GET正常")
            else:
                print("    WARN: 已连上网络，但HTTP服务器返回非200状态码")
        except Exception as e:
            print("    FAIL: HTTP GET请求失败:", e)
        finally:
            if response:
                response.close()

    finally:
        print("[6] 释放网络资源...")
        net.deinit()
        print("=== UniKnect 4G network test done ===")


main()
