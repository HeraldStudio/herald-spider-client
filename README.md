# herald-spider-client

herald-webservice 分布式爬虫客户端

### 使用说明

1. 修改 `config.json` 文件中默认 `defaultServer` 和 `defaultPort` 为服务器地址和端口
2. 执行 `npm install` 补全依赖
3. 在交互环境下启动爬虫 `node spider.js`

由于需要手动输入密钥，建议使用 Screen 作为进程管理工具

部署在树莓派上时，可以使用串口控制台

TTL:

    RX <-- Pin8 (UART_TXD)

    TX --> Pin10 (UART_RXD)

    GND === Pin6/Pin14

