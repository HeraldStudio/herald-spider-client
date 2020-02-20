/**
 * Created by WolfTungsten on 2018/2/5.
 */
const ws = require('ws')
const moment = require('moment')
const axios = require('axios')
const readline = require('readline');
const tough = require('tough-cookie');
const axiosCookieJarSupport = require('axios-cookiejar-support').default

// config.json 中仅有小部分的配置有效
const config = require('./config.json')
const chalk = require('chalk')
const crypto = require('crypto')

axiosCookieJarSupport(axios)
const program = require('commander');

program
  .version('1.0.0')
  .option('-s --server <server>', '服务器地址')
  .option('-p, --port <port>', '端口号',parseInt)
  .option('-k --keyFile <keyFile>', '密钥文件')
  .parse(process.argv);

const spiderCommonConfig = (() => {
    try {
      return require(program.keyFile)
    } catch (e) {
      return ''
    }
})()
/**
 ## 安全性

 由于学校部分 HTTPS 的上游服务器可能存在证书问题，这里需要关闭 SSL 安全验证。
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
// let isDefault = process.argv[2] === '--default'

// 256 color support
const chalkColored = new chalk.constructor({level: 2});

// 自定义一个console.log
const log = (msg) => {
    if (config.serverLog) {
        console.log(JSON.stringify(Buffer.from(JSON.stringify({msg}))))
    } else {
        console.log(msg)
    }
};

// 爬虫 token 解密
const decryptSipder = (value) => {
    try {
      let decipheriv = crypto.createDecipheriv(spiderCommonConfig.cipher, spiderCommonConfig.key, spiderCommonConfig.iv)
      let result = decipheriv.update(value, 'hex', 'utf8')
      result += decipheriv.final('utf8')
      return result
    } catch (e) {
      console.log(e)
      return ''
    }
  }

class Spider {
    constructor() {
        log('>>>>> Herald-Spider 分布式硬件爬虫客户端 <<<<<')
        this.active = false;
        this.connected = false;
        this.finalHeartBeat = +moment()
        this.connect(program.server, program.port)
        this.statusQueue = [];
        this.succCounter = 0
    }

    succStatus(){
        this.statusQueue.push(true);
        if (this.statusQueue.length < config.statusLength) {
            this.succCounter++
            return (this.succCounter / this.statusQueue.length * 100).toPrecision(3);
        } else {
            let out = this.statusQueue.shift();
            if (!out) {
                this.succCounter++
            }
            return (this.succCounter / config.statusLength * 100).toPrecision(3);
        }
    }

    failStatus(){
        this.statusQueue.push(false);
        if (this.statusQueue.length < config.statusLength) {
            return (this.succCounter / this.statusQueue.length * 100).toPrecision(3);
        } else {
            let out = this.statusQueue.shift();
            if (out) {
                this.succCounter--
            }
            return (this.succCounter / config.statusLength * 100).toPrecision(3);
        }
    }

    connect(address, port) {
        this.socket = new ws(`ws://${address}:${port}/`);
        this.socket.on('message', (data) => {
            this.handleData(data)
        })
        this.socket.on('error', (error) => {
            log(error.message);
            this.active = false;
            this.connected = false;
            process.exit(2)
        })
        this.socket.on('close', () => {
            log('[-] 服务器关闭');
            this.active = false;
            this.connected = false;
            process.exit(2)
        })
        this.socket.heartBeat = setInterval(() => {
            // 检服务器心跳是否正常
            let currentTime = +moment();
            // 执行心跳逻辑
            if (currentTime - this.finalHeartBeat >= 10 * config.heartCycle) {
                log(`爬虫${this.spiderName}由于服务器心跳超时退出`)
                process.exit(0);
            }
            try {
                this.socket.send('@herald—spider');
            } catch (e) {
            }
        }, config.heartCycle)
    }

    handleData(data) {
        if (data === '@herald-server') {
            // 来自服务器的心跳拦截
            this.finalHeartBeat = +moment();
            //log(chalkColored.gray(`❤️服务器心跳: ${(new Date)}`));
            return;
        }
        if (this.active) {
            let request;
            try {
                request = JSON.parse(data);
            } catch (e) {
                return
            }
            if (request.hasOwnProperty('data')) {
                request.data = Buffer.from(request.data.data).toString()
            }
            let cookieJar = new tough.CookieJar();
            if (request.cookie) {
                cookieJar = tough.CookieJar.fromJSON(request.cookie)
            } else {
                cookieJar = new tough.CookieJar()
            }
            let _axios = axios.create({
                withCredentials: true,
                jar: cookieJar,
                responseType: 'arraybuffer',
                transformResponse (res) {
                    return Buffer.from(res) // 将请求返回的结果转换成buffer
                }
            });

            log(`${chalkColored.bold('-->')} ${chalkColored.cyan(request.requestName)} ${chalkColored.yellow(chalkColored.bold(request.method.toUpperCase()))} ${request.url}`);

            _axios.request(request).then((response) => {
                //处理响应结果
                try {
                    let preRes = {
                        requestName: request.requestName,
                        succ: true,
                        data: Buffer.from(response.data),
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                        cookie: cookieJar.toJSON()
                    }
                    this.socket.send(JSON.stringify(preRes))

                    log(`${chalkColored.bold('<--')} ${chalkColored.cyan(request.requestName)} ${chalkColored.green(response.status)} ${response.statusText} ${chalkColored.magenta(`succ:${this.succStatus()}`)}`)

                } catch (e) {

                    log(`${chalkColored.bold('<--')} ${chalkColored.cyan(request.requestName)} ${chalkColored.red('xxx')} ${e.message} ${chalkColored.magenta(`succ:${this.failStatus()}`)}`)

                }

            }).catch((error) => {
                try {
                    let preRes = {
                        requestName: request.requestName,
                        succ: false,
                    };
                    this.socket.send(JSON.stringify(preRes))
                    log(`${chalkColored.bold('<--')} ${chalkColored.cyan(request.requestName)} ${chalkColored.red('xxx')} ${chalkColored.red(request.url)} ${chalkColored.magenta(`succ:${this.failStatus()}`)} `)
                } catch (e) {
                    log(`${chalkColored.bold('<--')} ${chalkColored.cyan(request.requestName)} ${chalkColored.red('xxx')} ${e.message} ${chalkColored.magenta(`succ:${this.failStatus()}`)} `)

                }
            })
        } else {
            if (data === 'Auth_Success') {
                this.active = true;
                log(`${chalkColored.green('[+]')} 认证成功`)
            } else if (data === 'Auth_Fail') {
                log(`${chalkColored.red('[-]')} 认证失败`)
                process.exit(1)
            } else {
                try {
                    this.spiderName = JSON.parse(data).spiderName
                    let token = decryptSipder(JSON.parse(data).secret)
                    log(`${chalkColored.green('[+]')} 连接建立成功，spiderName=${this.spiderName} `);
                    this.socket.send(JSON.stringify({
                        spiderName: this.spiderName,
                        token
                    }))
                } catch (e) {
                    console.error(e)
                }
            }
        }
    }
}

setTimeout(() => {
    new Spider()
}, 2 * 1000);


