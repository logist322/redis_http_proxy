const http = require('http');
const redis = require('@redis/client');

const REDIS_CONNECT_URL = '';

async function main() {
    const redisClient = await redis.createClient({
        url: REDIS_CONNECT_URL
    })
        .on('error', () => {
            console.error('Redis Client connection has not been finished.');
            process.exit(1);
        })
        .connect();

    http.createServer(async function (req, res) {
        console.log(req.headers.accept);
        const reqUrl = req.url.substring(1).split('?')[0];

        let rejectMessage = '';

        if (req.method !== 'POST') {
            rejectMessage += 'Only "POST" method is allowed.\n';
        }

        if (req.headers.accept !== 'application/json') {
            rejectMessage += 'Client must accept "application/json".\n';
        }

        if (!reqUrl) {
            rejectMessage += 'Empty endpoint is not allowed.\n';
        }

        if (rejectMessage) {
            res.writeHead(400);
            res.write(rejectMessage);
            res.end();
            return;
        }

        try {
            const body = await new Promise((resolve, reject) => {
                let body = [];
                req
                    .on('error', e => reject(e))
                    .on('data', chunk => {
                        body.push(chunk);
                    })
                    .on('end', () => {
                        resolve(JSON.parse(Buffer.concat(body).toString()));
                    });
            });

            const { action, key, value } = body;

            if (!action) {
                throw Error(
                    '`action` is not set.\n'
                );
            }

            if (!key) {
                throw Error(
                    '`key` is not set.\n'
                );
            }

            if (action !== 'get' && action !== 'set') {
                throw Error(
                    '`action` has unknown variant. `action` can be "get" or "set".\n'
                );
            }

            if (action === 'set' && !value) {
                throw Error(
                    '`value` is not set. `value` must be set and must be not empty while using `"action": "set"`.\n'
                );
            }

            const resBody = { 'key': key };
            switch (action) {
                case 'get':
                    resBody['value'] = await redisClient.get(key);
                case 'set':
                    await redisClient.set(key, value);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.write(JSON.stringify(resBody));
            res.end();
        } catch (e) {
            res.writeHead(400);
            res.write(e);
            res.end();
        }
    }).on('close', () => redisClient.disconnect()).listen(8080);
}

main();
