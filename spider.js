/**
 * Created by WolfTungsten on 2018/2/5.
 */
const net = require('net')
const ws = require('ws')
const axios = require('axios')
const readline = require('readline');
const tough = require('tough-cookie');
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const chardet = require('chardet')
const iconv = require('iconv')
const config = require('./config.json')
const chalk = require('chalk')
const input = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
axiosCookieJarSupport(axios)

/**
 ## 安全性

 由于学校部分 HTTPS 的上游服务器可能存在证书问题，这里需要关闭 SSL 安全验证。
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

class Spider {
  constructor() {
    console.log('>>>>> Herald-Spider 分布式硬件爬虫客户端 <<<<<')
    this.active = false
    input.question(`${chalk.blue('[Input]')} 服务器地址 (${config.defaultServer}) `, (address) => {
      if (address === '') {
        address = config.defaultServer
      }
      input.question(`${chalk.blue('[Input]')} 服务器地址 (${config.defaultPort}) `, (port) => {
        if (port === '') {
          port = config.defaultPort
        }
        port = parseInt(port)
        this.socket = new ws(`ws://${address}:${port}/`);
        this.socket.on('message', (data) => { this.handleData(data) })
        this.socket.on('error', (error) => { console.log(error) })
        this.socket.on('close',() => { console.log('[-]服务器关闭') })
          this.socket.heartBeat = setInterval(() => {
          try {
              this.socket.send('@herald—spider')
          } catch (e) {}
          }, config.heartCycle)
      })
    })

  }

  handleData(data){
    if (this.active) {
      let request = JSON.parse(data)
      if(request.hasOwnProperty('data')){
        request.data = Buffer.from(request.data.data).toString()
      }
      let cookieJar = new tough.CookieJar()
      if (request.cookie) {
        cookieJar = tough.CookieJar.fromJSON(request.cookie)
      } else {
        cookieJar = new tough.CookieJar()
      }
      let _axios = axios.create({
        withCredentials:true,
        jar:cookieJar,
        responseType: 'arraybuffer',
        transformResponse (res) {
          let encoding = chardet.detect(res)
          res = new iconv.Iconv(encoding, 'UTF-8//TRANSLIT//IGNORE').convert(res).toString()
          return res
        }
      })

      console.log(`${chalk.blue(request.requestName)} ${chalk.bold('-->')} ${chalk.yellow(chalk.bold(request.method.toUpperCase()))} ${request.url}`)
      _axios.request(request).then((response)=>{
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
            console.log(`${chalk.bold('<--')} ${chalk.blue(request.requestName)} ${chalk.green(response.status)} ${response.statusText}`)

        } catch(e) {
          console.log(`${chalk.bold('<--')} ${chalk.blue(request.requestName)} ${chalk.red('xxx')} ${e.message}`)
        }

      }).catch((error) => {
        try {
          let preRes = {
              requestName: request.requestName,
              succ: false,
              status: error.response.status,
              statusText: error.response.statusText,
              headers: error.response.headers,
              message: error.message

          }
          if (error.response.hasOwnProperty('data')) {
              preRes.data = Buffer.from(error.response.data)
          }
          this.socket.send(JSON.stringify(preRes))
          console.log(`${chalk.bold('<--')} ${chalk.blue(request.requestName)} ${chalk.red(response.status)} ${response.statusText}`)
        } catch (e) {
            console.log(`${chalk.bold('<--')} ${chalk.blue(request.requestName)} ${chalk.red('xxx')} ${e.message}`)
        }
      })
    } else {
      if(data === 'Auth_Success'){
        this.active = true
        console.log(`${chalk.green('[+]')} 认证成功`)
      } else if (data === 'Auth_Fail') {
        console.log(`${chalk.red('[-]')} 认证失败`)
          process.exit(2)

      } else {
        try {
          let spiderName = JSON.parse(data).spiderName
          console.log(`${chalk.green('[+]')} 连接建立成功，spiderName=${spiderName} `)
          input.question(`${chalk.blue('[Input]')} 登陆口令：`,(answer)=>{
            this.socket.send(JSON.stringify({token:answer}))
          })
        } catch(e) {
          console.log(e)
        }
      }
    }
  }
}

new Spider()

