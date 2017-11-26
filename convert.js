"use strict";

const fs = require('fs'),
    dom5 = require('dom5'),
    parse5 = require('parse5'),
    eachLimit = require('async/eachLimit'),
    request = require('request');

let mimetypes = {
    '.gif':  'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg':  'image/jpeg',
    '.jpe':  'image/jpeg',
    '.png':  'image/png'
};

const htmlTemplate = fs.readFileSync("./emailTemplateLogoLink.html", 'utf8'); // for testing.


let doConvert = function(html, callback) {

    try {

        let doc = parse5.parse(html);
        let imgTags = dom5.queryAll(doc, dom5.predicates.hasTagName('img'));

        console.log('found ' + imgTags.length + ' img tags');

        let imgDataObj = {};
        if (!(imgTags && imgTags.length)) {
            return callback(html);
        } else {
            eachLimit(imgTags, 1, (obj, next) => {
                let attr = getAttr(obj);
                if (attr.src) {
                    imgDataObj.localFileName = 'localTmpImage';

                    downloadImg(attr.src.value, imgDataObj, function() {
                        let base64 = encode(imgDataObj.localFileName);

                        attr.src.value = 'data:image/png' //+ imgDataObj.contentType || 'png'
                            + ';base64,' + base64;

                        next();
                    });
                }
                else {
                    next();
                }
            }, function(err) {
                // TODO:
                callback(parse5.serialize(doc));
            });
        }

    } catch (ex) {
        console.log(ex);
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
    request.head(uri, function(err, res, body) {

        if (err) {
            return callback(err);
        }

        //if (!res.headers['content-type'] || !res.headers['content-length']){
        //    return callback('missing headers');
        //}

        // TODO: check content-type headers against white list.
        console.log('content-type:', res.headers['Content-Type']);
        imgDataObj.contentType = res.headers['Content-Type'];

        console.log('content-length:', res.headers['Content-Length']);
        imgDataObj.contentLength = res.headers['Content-Length'];

        request(uri).pipe(fs.createWriteStream(imgDataObj.localFileName)).on('close', callback);
    });
};

let encode = function(filePath) {
    return new Buffer(fs.readFileSync(filePath)).toString('base64');
};



doConvert(htmlTemplate, function(newHtml) {
    if (newHtml)
        fs.writeFile("newhtmltest.html", newHtml, function(err) {
            if(err)
                return console.log(err);
            console.log("The new html was saved!");
        });
    else
        console.log("new html not found!");
});
