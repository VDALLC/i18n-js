(function(root) {
    'use strict';

    var i18n = {};

    var AuditorBase = function() {};
    i18n.AuditorBase = AuditorBase;

    AuditorBase.KEY_USE         = 0;
    AuditorBase.KEY_MISS        = 1;
    AuditorBase.KEY_INVALID     = 2;
    AuditorBase.PLURALIZER_MISS = 3;
    AuditorBase.KEYWORD_MISS    = 4;

    var NullAuditor = function() {};
    i18n.NullAuditor = NullAuditor;

    NullAuditor.prototype.log = function(translationId, event) {};

    var PluralizerBase = function() {
        this._forms = [];
    };
    i18n.PluralizerBase = PluralizerBase;

    PluralizerBase.FORM_ZERO  = 'zero';
    PluralizerBase.FORM_ONE   = 'one';
    PluralizerBase.FORM_TWO   = 'two';
    PluralizerBase.FORM_FEW   = 'few';
    PluralizerBase.FORM_MANY  = 'many';
    PluralizerBase.FORM_OTHER = 'other';

    /**
    * Gets pluaral form of given number
    *
    * @param numeric $number
    * @return string on of ['zero','one','two','few','many','other'] depending on number and language
    * @see http://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html
    */
    PluralizerBase.prototype.getForm = function(number) {
        throw new Error('Method is not implemented');
    };

    PluralizerBase.prototype.getFormIdx = function(number) {
        return this._forms.indexOf(this.getForm(number));
    };

    var English = function() {
        PluralizerBase.call(this);

        this._forms = [
            PluralizerBase.FORM_ONE,
            PluralizerBase.FORM_OTHER];
    };
    i18n.English = English;

    English.prototype = Object.create(PluralizerBase.prototype);
    English.prototype.constructor = English;

    English.prototype.getForm = function(number) {
        if (number == 1) {
            return PluralizerBase.FORM_ONE;
        } else {
            return PluralizerBase.FORM_OTHER;
        }
    };

    var Russian = function() {
        PluralizerBase.call(this);

        this._forms = [
            PluralizerBase.FORM_ONE,
            PluralizerBase.FORM_FEW,
            PluralizerBase.FORM_MANY,
            PluralizerBase.FORM_OTHER];
    };
    i18n.Russian = Russian;

    Russian.prototype = Object.create(PluralizerBase.prototype);
    Russian.prototype.constructor = Russian;

    Russian.prototype.getForm = function(number) {
        // for fractional numerals
        if (number % 1 != 0) {
            return PluralizerBase.FORM_OTHER;
        }

        var mod10 = number % 10;
        var mod100 = number % 100;

        if (mod10 == 1 && mod100 != 11) {
            return PluralizerBase.FORM_ONE;
        } else if ((mod10 >= 2 && mod10 <= 4) && (mod100 < 12 || mod100 > 14)) {
            return PluralizerBase.FORM_FEW;
        } else if (mod10 == 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 14)) {
            return PluralizerBase.FORM_MANY;
        } else {
            return PluralizerBase.FORM_OTHER;
        }
    };

    var PluralizerFactory = function(defaultLang) {
        this._defaultLang = defaultLang || 'en';
        this._pluralizers = {
            ru: Russian,
            en: English,
            it: English
        };

        if (!this._pluralizers[this._defaultLang]) {
            throw new Error('Unable to lookup pluralizer for fallback language ' + this._defaultLang);
        }
    };
    i18n.PluralizerFactory = PluralizerFactory;

    PluralizerFactory.prototype.getPluralizer = function(lang) {
        if (this._pluralizers[lang] == null) {
            return null;
        }

        return new this._pluralizers[lang]();
    };

    PluralizerFactory.prototype.getDefaultPluralizer = function() {
        return new this._pluralizers[this._defaultLang]();
    };

    PluralizerFactory.prototype.addPluralizer = function(lang, constructor) {
        this._pluralizers[lang] = constructor;
    };

    var KeyValueStorage = function() {
        this._storage = {};
    };
    i18n.KeyValueStorage = KeyValueStorage;

    KeyValueStorage.prototype.get = function(translationId) {
        var str = this._storage[this._buildKey(translationId)];

        return str === undefined || str === null ? null : str;
    };
    KeyValueStorage.prototype.set = function(translation) {
        this._storage[this._buildKey(translation)] = translation.translation
    };
    KeyValueStorage.prototype.remove = function(translationId) {
        delete this._storage[this._buildKey(translationId)];
    };
    KeyValueStorage.prototype.batchSet = function(translations) {
        for (var i = 0; i < translations.length; ++i) {
            this.set(translations[i]);
        }
    };
    KeyValueStorage.prototype.batchDelete = function(translationIds) {
        for (var i = 0; i < translationIds.length; ++i) {
            this.remove(translationIds[i]);
        }
    };
    KeyValueStorage.prototype._buildKey = function(translationId) {
        return translationId.lang + '/' + translationId.sectionId + '/' + translationId.key;
    };

    var TranslationId = function(key, lang, sectionId) {
        this.key = key;
        this.lang = lang;
        this.sectionId = sectionId || 0;
    };
    i18n.TranslationId = TranslationId;

    var Translation = function(translation, key, lang, sectionId) {
        TranslationId.call(this, key, lang, sectionId);

        this.translation = translation;
    };
    i18n.Translation = Translation;

    Translation.prototype = Object.create(TranslationId.prototype);
    Translation.prototype.constructor = Translation;

    var I18nService = function(storage, pluralizerFactory, auditor) {
        this._storage = storage;
        this._pluralizerFactory = pluralizerFactory;
        this._auditor = auditor;

        this._pluralizers = {};
    };
    i18n.I18nService = I18nService;

    I18nService.prototype.translate = function(id, params) {
        params = params || {};

        if (!this._checkKey(id.key)) {
            this._auditor.log(id, AuditorBase.KEY_INVALID);
            return '';
        }

        var str = this._storage.get(id);

        if (str === null) {
            this._auditor.log(id, AuditorBase.KEY_MISS);
            return id.key;
        }

        this._auditor.log(id, AuditorBase.KEY_USE);

        var length = 0;
        for (var key in params) {
            length++;
        }

        return length == 0 ? str : this._interpolate(id, str, params);
    };

    I18nService.prototype.isExist = function(id) {
        return this._storage.get(id) != null;
    };

    I18nService.prototype._checkKey = function(key) {
        return key.match(/^[a-z0-9.#={}\[\]\-]+$/) != null;
    };

    I18nService.prototype._interpolate = function(id, str, params) {
        var search = [];
        var replace = [];

        for (var k in params) {
            search.push('%{' + k + '}');
            replace.push(params[k]);
        }

        var localMatch;
        var match = [];
        var reg = new RegExp("%{(\\w+)?(?:\\s*,\\s*(\\w+))?\\s*->\\s*([^}]*)}", "g");

        while (localMatch = reg.exec(str)) {
            match.push(localMatch);
        }

        if (match) {
            var pluralizer = this._getPluralizer(id);

            for (var i = 0; i < match.length; ++i) {
                search.push(match[i]['0']);
                replace.push(this._resolveOperator(id, pluralizer, match[i], params));
            }
        }

        for (var j = 0; j < search.length; ++j) {
            str = str.replace(search[j], replace[j]);
        }
        return str;
    };

    I18nService.prototype._getPluralizer = function(id) {
        if (this._pluralizers[id.lang] == null) {
            this._pluralizers[id.lang] = this._pluralizerFactory.getPluralizer(id.lang);
        }

        if (this._pluralizers[id.lang] == null) {
            this._auditor.log(id, AuditorBase.PLURALIZER_MISS);
            this._pluralizers[id.lang] = this._pluralizerFactory.getDefaultPluralizer();
        }

        return this._pluralizers[id.lang];
    };

    I18nService.prototype._resolveOperator = function(id, pluralizer, opp, params) {
        var op = {
            count: opp[1],
            sex: opp[2],
            text: opp[3]
        };

        var byForm = op['text'].split(',');

        var pluralIdx = 0;
        if (op['count'] == null) {
            pluralIdx = 0;
        } else if (!params.hasOwnProperty(op['count'])) {
            this._auditor.log(id, AuditorBase.KEY_MISS);
            pluralIdx = 0;
        } else {
            pluralIdx = pluralizer.getFormIdx(params[op['count']]);

            if (!byForm.hasOwnProperty(pluralIdx.toString())) {
                pluralIdx = 0;
            }
        }

        var bySex = byForm[pluralIdx].split('|');
        var sex = 0;
        if (op['sex'] == null) {
            sex = 0;
        } else if (!params.hasOwnProperty(op['sex'])) {
            //TODO Audit missing sex parameter
            sex = 0;
        } else {
            sex = params[op['sex']];

            if (!bySex.hasOwnProperty(sex.toString())) {
                sex = 0;
            }
        }

        return bySex[sex];
    };

    root.vda = root.vda || {};
    root.vda.i18n = i18n;

    if (typeof define === 'function' && define.amd) {
        define('vda/i18n', function() {
            return i18n;
        });
    }
})(this);