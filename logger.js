/**
 * Created by WolfTungsten on 2018/3/22.
 */
const {spawn} = require('child_process');

const path = process.cwd() + '/spider.log';

let messageProcess = spawn('tail', ['-f', path]);

messageProcess.stdout.on('data', (chunk) => {
    "use strict";
    let message = chunk.toString();
    message.trim().split('\n').map(message => {
        console.log(JSON.parse(message).msg);
    })
});

process.on('exit', (code) => {
    messageProcess.kill()
});