const fs = require('fs');
const puppeteer = require('puppeteer');
const readline = require('readline');

let config = null;

function isLogined(page) {
    let cookie = "";
    return new Promise(resolve => {
        fs.exists("cookie.txt", exists => {
            if (!exists) {
                resolve(false);
            } else {
                let rs = fs.createReadStream("cookie.txt")
                .setEncoding("UTF8");
                rs.on('data', (data)=> {
                    cookie += data;
                });
                rs.on('end', () => {
                    if (cookie != "") {
                        JSON.parse(cookie).map((item) => {
                            page.setCookie(item);
                        })
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                })
            }}
        )
    })
}

async function login(page) {
    await page.goto("https://weibo.com/");
    await page.waitForNavigation(100000);
    await page.type("#loginname", config.username);
    await page.type("#pl_login_form > div > div:nth-child(3) > div.info_list.password > div > input", config.password);
    await page.click("#pl_login_form > div > div:nth-child(3) > div:nth-child(6)");
    await page.waitForNavigation().then(result => {
        console.log("login success");
        return new Promise((resolve) => {
            page.cookies().then(cookie => {
                fs.createWriteStream("cookie.txt").write(JSON.stringify(cookie), "UTF8"); });
            resolve();
        })
    }).catch(e => {
        page.screenshot({
            path: 'code.png',
            type: 'png',
            x: 800,
            y: 200,
            width: 100,
            height: 100
        });
        return new Promise((resolve,reject) => {
            readSyncByRl("请输入验证码").then((code) => {
                (async() => {
                    await page.type("#pl_login_form > div > div:nth-child(3) > div.info_list.verify.clearfix > div > input", code);
                    await page.click("#pl_login_form > div > div:nth-child(3) > div:nth-child(6)");
                    await page.waitForNavigation();
                    console.log("login success");
                    page.cookies().then(cookie => {
                        fs.createWriteStream("cookie.txt").write(JSON.stringify(cookie), "UTF8");
                    });
                    resolve();
                })();
            })
        })
    })
}


async function repost(page) {
    for (let index = 0; index < config.platforms.length; index++) {
        await page.goto(config.platforms[index]);
        let feedId = await page.$eval("div[id^='Pl_Official_MyProfileFeed']", ele => {
            return ele.id;
        });
        console.log(feedId);
        for (let i = 2; i<10; i++) {
            let shareSelector = `#${feedId} > div > div:nth-child(${i}) > div.WB_feed_handle > div > ul > li:nth-child(2) > a > span > span > span > em.W_ficon.ficon_forward.S_ficon`;
            await Promise.all([page.click(shareSelector), page.waitFor(3000)]).then(res => {
                (async ()=> {
                    let layer_id = await page.$$eval('div.W_layer', ele => {
                        return ele[1].id
                    });
                    let shareConfirmSelector = `#${layer_id} > div.content > div.layer_forward > div > div:nth-child(2) > div > div.WB_feed_repeat.forward_rpt1 > div > div.WB_feed_publish.clearfix > div > div.p_opt.clearfix > div.btn.W_fr > a`;
                    console.log(shareConfirmSelector);
                    await page.click(shareConfirmSelector);
                    await page.waitFor(2000);
                    await autoScroll(page);
                })();
            }).catch(e => {
                console.log("转发失败");
            });
        }
    }
}


function readSyncByRl(tips) {
    tips = tips || '> ';
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(tips, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 50;
            window.scrollBy(0, distance);
            totalHeight += distance;
            resolve(totalHeight);
        });
    });
}


(async () => {
    fs.readFile('config.json','utf8',function (err, data) {
        (async () => {
            if(err) {
                console.log(err);
                return;
            }
            config=JSON.parse(data);
            const browser = await puppeteer.launch({
                headless: false,
                slowMo: 50,
                executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            }).catch(e => {
                console.log(e);
            });
            const page = (await browser.pages())[0];
            await page.setViewport({
                width: 1280,
                height: 800
            });
            await login(page).then(_ => {
                (async () => {
                    await repost(page);
                })();
            })
            // await isLogined(page).then(res => {
            //     if (res) {
            //         (async () => {
            //             await repost(page);
            //         })(); 
            //     } else {
            //         login(page).then(_ => {
            //             (async () => {
            //                 await repost(page);
            //             })();
            //         })
            //     }
            // })
        })();
    });
})();