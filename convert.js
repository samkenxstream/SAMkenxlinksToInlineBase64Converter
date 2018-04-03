"use strict";

const fs = require('fs'),
    dom5 = require('dom5'),
    parse5 = require('parse5'),
    eachLimit = require('async/eachLimit'),
    fileType = require('file-type'),
    path = require('path'),
    request = require('request');

const tmpDir = './tmpFiles/',
    productDir = './product/';

// for local files
let baseHtmlDir = '';

//const htmlTemplate = fs.readFileSync("./test/imagesLinksTest.html", 'utf8'); // for testing.

let doConvert = function(html, callback) {

    try {

        let doc = parse5.parse(html);
        // find all img tags
        let imgTags = dom5.queryAll(doc, dom5.predicates.hasTagName('img'));

        if (!imgTags || !imgTags.length) {
            console.log('did not find any img tags');
            return callback(null, null);
        }
        else {
            console.log('found ' + imgTags.length + ' img tags');
            let imgDataObj = {};
            eachLimit(imgTags, 1, (obj, next) => {

                let attr = getAttr(obj);
                if (attr.src) {
                    imgDataObj.localFileName = path.resolve(tmpDir+'localDownloadedImg');
                    downloadImg(attr.src.value, imgDataObj, function() {
                        if (imgDataObj.err) {
                            console.log('err: ' + attr.src.value + ' ' + imgDataObj.err);
                            next();
                        }
                        else {
                            let theData = encode(imgDataObj.localFileName);
                            let theType = fileType(theData.buffer);
                            attr.src.value = 'data:' + theType.mime
                                + ';base64,' + theData.base64;
                            next();
                        }
                    });
                }
                else {
                    next();
                }
            }, function(err) {
                if (err)
                    return callback(err);
                return callback(null, parse5.serialize(doc));
            });
        }

    } catch (ex) {
        callback(ex);
    }

};

let getAttr = function(img) {
    let retAttr = {
        src: null
    };

    if (img.attrs) {
        img.attrs.forEach(function(attr) {
            // TODO: more generic, loop on retAttr keys
            if (attr.name === 'src') {
                retAttr.src = attr;
            }
        });
    }

    return retAttr;
};

let downloadImg = function(uri, imgDataObj, callback) {

    try {
        let localPath = path.resolve(`${baseHtmlDir}/${uri}`);
        console.log(localPath);
        if (fs.existsSync(localPath) && fs.lstatSync(localPath).isFile()) {
            imgDataObj.localFileName = localPath;
            console.log(localPath + ' is local file');
            return callback();
        }

        request.head(uri, function (err, res, body) {
            if (err) {
                imgDataObj.err = err;
                return callback();
            }
            request(uri).pipe(fs.createWriteStream(imgDataObj.localFileName)).on('close', callback);
        });
    }
    catch (ex) {
        imgDataObj.err = ex;
        return callback();
    }
};

let encode = function(filePath) {
    let buff = new Buffer(fs.readFileSync(filePath));
    return {
        buffer: buff,
        base64: buff.toString('base64'),
    };
};


if (require.main === module) {

    console.log('called directly');

    if (!process.argv[2] || !fs.existsSync(process.argv[2]) || !fs.lstatSync(process.argv[2]).isFile()) {
        console.log('Usage: input should be path to html file or to directory containing html files with assets')
        process.exit(0);
    }
    else {

        if (!fs.existsSync(productDir))
            fs.mkdirSync(productDir);

        if (!fs.existsSync(tmpDir))
            fs.mkdirSync(tmpDir);

        let filename = process.argv[2];
        baseHtmlDir = path.dirname(filename);

        // for manual
        //if (!filename)
        //    filename = 'C:\\Users\\MaorDahan\\Desktop\\New folder\\new-welcome.html';

        let originHtml = fs.readFileSync(filename, 'utf8');
        doConvert(originHtml, function(err, newHtml) {
            if (err) {
                console.log('failed: ' + err);
                process.exit(0);
            }

            if (newHtml) {
                let newfilename = productDir + path.basename(filename, path.extname(filename)) + '_inlineBase64.html';
                fs.writeFile(newfilename, newHtml, function (err) {
                    if (err) {
                        console.log('failed write new file: ' + err);
                        process.exit(0);
                    }
                    console.log("New html was saved here: " + newfilename);
                    process.exit(1);
                });
            }
            else {
                console.log("no changes");
                process.exit(1);
            }
        });

    }

}

module.exports = {
    doConvert: doConvert
};
