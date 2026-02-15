import Store from 'electron-store';
const store = new Store();


class Config {
    /**
     * 
     * @returns {Object} 配置对象
     */
    static init() {
        // 读取配置文件
        const defaultConfig = {
            version: {
                subjects: 1,
                title: 1,
                caption: 1,
                style: 1,
                saveTime: 1,
                zoom: 1,
                autoSaveGap: 1,
                debug: 1,
                templates: 1,
                image: 1,               // 新增图片配置版本
            },
            subjects: ["语文", "数学", "英语", "物理", "化学", "生物", "政治", "历史", "地理", "信息", "通用"],
            title: "HomeworkBoard",
            caption: "晚自习作业清单",
            style: "",
            saveTime: [1220, 1300],
            zoom: 1,
            autoSaveGap: 10,
            debug: false,
            templates: {},
            imagePaths: [],              // 新增图片路径字段，默认为空
        };
        let config = store.get('config');
        if (!config) {
            config = defaultConfig;
        } else {
            if (!config.version) {
                config = defaultConfig;
            } else {
                for (let key in defaultConfig.version) {
                    if (config.version[key] !== defaultConfig.version[key]) {
                        config.version[key] = defaultConfig.version[key];
                        config[key] = defaultConfig[key];
                    }
                }
                for (let key in config) {
                    if (!defaultConfig.hasOwnProperty(key)) {
                        delete config[key];
                    }
                }
            }
        }
        store.set('config', config);
        return config;
    }

}

export default Config;