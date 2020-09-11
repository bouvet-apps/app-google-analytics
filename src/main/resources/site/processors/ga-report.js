var portalLib = require('/lib/xp/portal');
var cacheLib = require("/lib/cache");

var forceArray = function (data) {
    if (data === undefined || data === null || (typeof data === "number" && isNaN(data))) return [];
    return Array.isArray(data) ? data : [data];
};

var siteConfigCache = cacheLib.newCache({
    size: 20,
    expire: 10 * 60 // 10 minute cache
});

exports.responseProcessor = function (req, res) {
    if (req.mode !== 'live') {
        return res;
    }

    var site = portalLib.getSite();

    if (site && site._path) {
        var siteConfig = siteConfigCache.get(req.branch + "_" + site._path, function () {
            var config = portalLib.getSiteConfig() || {};
            config.disableCookies = forceArray(config.disableCookies);
            config.disableCookies.push({ name: app.name.replace(/\./g, "-") + "_disabled", value: "true" });
            return config;
        });


        var trackingID = siteConfig['trackingId'] || '';
        var enableTracking = siteConfig['enableTracking'] || false;
        var enableAnonymization = siteConfig['enableAnonymization'] || false;
        var disableCookies = siteConfig['disableCookies'];

        if (!trackingID || !enableTracking) {
            return res;
        }

        var cookies = req.cookies;
        if (res.cookies) {
            var resCookieKeys = Object.keys(res.cookies);
            for (var keyIndex = 0; keyIndex < resCookieKeys.length; keyIndex++) {
                var key = resCookieKeys[keyIndex];
                if (res.cookies[key].value) {
                    cookies[key] = res.cookies[key].value;
                } else {
                    cookies[key] = res.cookies[key];
                }
            }
        }

        for (var cookieIndex = 0; cookieIndex < disableCookies.length; cookieIndex++) {
            var disableCookie = disableCookies[cookieIndex];

            if (cookies[disableCookie.name] === disableCookie.value) {
                return res;
            }
        }

        var snippet = '<!-- Google Analytics -->';
        snippet += '<script>';
        snippet += '(function(i,s,o,g,r,a,m){i[\'GoogleAnalyticsObject\']=r;i[r]=i[r]||function(){';
        snippet += '(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),';
        snippet += 'm=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)';
        snippet += '})(window,document,\'script\',\'//www.google-analytics.com/analytics.js\',\'ga\');';
        snippet += 'ga(\'create\', \'' + trackingID + '\', \'auto\');';
        snippet += 'ga(\'send\', \'pageview\'' + (enableAnonymization ? ', {\'anonymizeIp\': true}' : '') + ');';
        snippet += '</script>';
        snippet += '<!-- End Google Analytics -->';

        var headEnd = res.pageContributions.headEnd;
        if (!headEnd) {
            res.pageContributions.headEnd = [];
        }
        else if (typeof (headEnd) == 'string') {
            res.pageContributions.headEnd = [headEnd];
        }

        res.pageContributions.headEnd.push(snippet);
    }
    return res;
};
