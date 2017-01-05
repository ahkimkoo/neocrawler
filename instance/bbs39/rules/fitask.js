module.exports = {
    "domain": "39.net",
    "url_pattern": "/fitask/\\d+",
    "alias": "fitask",
    "id_parameter": ["#"],
    "encoding": "auto",
    "type": "branch",
    "save_page": false,
    "format": "html",
    "jshandle": false,
    "extract_rule": {
        "category": "crawled",
        "rule": {}
    },
    "cookie": [],
    "inject_jquery": false,
    "load_img": false,
    "drill_rules": ["a"],
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
    "priority": 4,
    "weight": 10,
    "schedule_interval": 86400,
    "active": true,
    "seed": ["http://jianfei.39.net/fitask/27-32-1.html"],
    "schedule_rule": "FIFO",
    "use_proxy": false,
    "first_schedule": 0
}
