module.exports = {
    "domain": "39.net",
    "url_pattern": "news.39.net/\\w+/\\d+/\\d+.html",
    "alias": "news",
    "id_parameter": [],
    "encoding": "gb2312",
    "type": "node",
    "save_page": true,
    "format": "html",
    "jshandle": false,
    "extract_rule": {
        "category": "crawled",
        "rule": {
            "title": {
                "base": "content",
                "mode": "css",
                "expression": "title",
                "pick": "text",
                "index": 1
            },
            "keywords": {
                "base": "content",
                "mode": "css",
                "expression": "meta[name=keywords]",
                "pick": "@content",
                "index": -1
            },
            "description": {
                "base": "content",
                "mode": "css",
                "expression": "meta[name=description]",
                "pick": "@content",
                "index": -1
            },
            "content": {
                "base": "content",
                "mode": "css",
                "expression": ".art_box *:not(script)",
                "pick": "text",
                "index": -1
            },
            "img": {
                "base": "content",
                "mode": "css",
                "expression": ".art_box img, .conBox img",
                "pick": "@src",
                "index": -1
            }
        }
    },
    "cookie": [],
    "inject_jquery": false,
    "load_img": false,
    "drill_rules": [],
    "drill_relation": {
        "base": "content",
        "mode": "css",
        "expression": "title",
        "pick": "text",
        "index": 1
    },
    "validation_keywords": [],
    "script": [],
    "navigate_rule": [],
    "stoppage": -1,
    "priority": 1,
    "weight": 10,
    "schedule_interval": 86400,
    "active": true,
    "seed": [],
    "schedule_rule": "FIFO",
    "use_proxy": false,
    "first_schedule": 0
}
