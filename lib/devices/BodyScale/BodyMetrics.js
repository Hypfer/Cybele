//Ported from https://github.com/wiecosystem/Bluetooth/blob/master/sandbox/body_metrics.py
/**
 *
 * @param options {object}
 * @param options.height {number} //in cm
 * @param options.age {number}
 * @param options.sex {"M"|"F"}
 * @constructor
 */
const BodyMetrics = function(options) {
    this.height = parseFloat(options.height);
    this.age = parseFloat(options.age);
    this.sex = options.sex;

    if(isNaN(this.height) || this.height > 220) {
        throw new Error("220cm height max");
    }

    if(isNaN(this.age) || this.age > 99) {
        throw new Error("99 years age max");
    }

    if(this.sex !== "M" && this.sex !== "F") {
        throw new Error("invalid sex");
    }
};

BodyMetrics.prototype.getLBMCoefficient = function(weight, impedance) {
    let lbm =  (this.height * 9.058 / 100) * (this.height / 100);
    lbm += weight * 0.32 + 12.226;
    lbm -= impedance * 0.0068;
    lbm -= this.age * 0.0542;

    return lbm;
};

BodyMetrics.prototype.getBMR = function(weight) {
    let bmr;

    switch(this.sex) {
        case "M":
            bmr = 877.8 + weight * 14.916;
            bmr -= this.height * 0.726;
            bmr -= this.age * 8.976;
            if(bmr > 2322) {
                bmr = 5000;
            }
            break;
        case "F":
            bmr = 864.6 + weight * 10.2036;
            bmr -= this.height * 0.39336;
            bmr -= this.age * 6.204;
            if(bmr > 2996) {
                bmr = 5000;
            }
            break;
    }

    return BodyMetrics.CHECK_OVERFLOW(bmr, 500, 10000);
};

BodyMetrics.prototype.getBMRScale = function(weight) {
    let bmrScale;

    Object.keys(BodyMetrics.BMR_COEFFICIENTS_BY_AGE_AND_SEX[this.sex]).some(k => {
        if(k > this.age) {
            bmrScale = weight * BodyMetrics.BMR_COEFFICIENTS_BY_AGE_AND_SEX[this.sex][k];
            return true;
        }
    });

    return bmrScale;
};

BodyMetrics.prototype.getFatPercentage = function(weight, impedance) {
    const LBM = this.getLBMCoefficient(weight, impedance);
    let negativeConstant;
    let coefficient;
    let fatPercentage;

    if(this.sex === "F") {
        if(this.age <= 49) {
            negativeConstant = 9.25;
        } else {
            negativeConstant = 7.25;
        }
    } else {
        negativeConstant = 0.8;
    }

    if(this.sex === "M" && weight < 61) {
        coefficient = 0.98;
    } else if(this.sex === "F" && weight > 60) {
        coefficient = 0.96;
        if(this.height > 160) {
            coefficient = coefficient*1.03;
        }
    } else if(this.sex === "F" && weight < 50) {
        coefficient = 1.02;
        if(this.height > 160) {
            coefficient = coefficient*1.03;
        }
    } else {
        coefficient = 1.0;
    }

    fatPercentage = (1.0 - (((LBM - negativeConstant) * coefficient) / weight)) * 100;
    if(fatPercentage > 63) {
        fatPercentage = 75;
    }

    return BodyMetrics.CHECK_OVERFLOW(fatPercentage, 5, 75);
};

BodyMetrics.prototype.getFatPercentageScale = function() {
    let scale;
    BodyMetrics.FAT_PERCENTAGE_SCALES.some(s => {
        if(this.age >= s.min && this.age <= s.max) {
            scale = s[this.sex];
            return true;
        }
    });

    return scale;
};

BodyMetrics.prototype.getWaterPercentage = function(weight, impedance) {
    let waterPercentage = (100 - this.getFatPercentage(weight, impedance)) * 0.7;
    let coefficient;

    if(waterPercentage <= 50) {
        coefficient = 1.02;
    } else {
        coefficient = 0.98;
    }

    if(waterPercentage * coefficient >= 65) {
        waterPercentage = 75;
    }

    return BodyMetrics.CHECK_OVERFLOW(waterPercentage * coefficient, 35, 75);
};

BodyMetrics.prototype.getWaterPercentageScale =  function() {
    return [53, 67]; //TODO: ???
};

BodyMetrics.prototype.getBoneMass = function(weight, impedance) {
    let base;
    let boneMass;

    if(this.sex === "F") {
        base = 0.245691014;
    } else {
        base = 0.18016894;
    }

    boneMass = (base - (this.getLBMCoefficient(weight, impedance) * 0.05158)) * -1;

    if(boneMass > 2.2) {
        boneMass += 0.1;
    } else {
        boneMass -= 0.1;
    }

    if(this.sex === "F" && boneMass > 5.1) {
        boneMass = 8;
    } else if(this.sex === "M" && boneMass > 5.2) {
        boneMass = 8;
    }

    return BodyMetrics.CHECK_OVERFLOW(boneMass, 0.5, 8);
};

BodyMetrics.prototype.getBoneMassScale = function(weight) {
    let scale;
    BodyMetrics.BONE_MASS_SCALES.some(s => {
        if(weight >= s[this.sex].min) {
            scale = [s[this.sex].optimal -1, s[this.sex].optimal +1];
            return true;
        }
    });

    return scale;
};

BodyMetrics.prototype.getMuscleMass = function(weight, impedance) {
    let muscleMass = weight - ((this.getFatPercentage(weight, impedance) * 0.01) * weight) - this.getBoneMass(weight, impedance);

    if(this.sex === "F" && muscleMass >= 84) {
        muscleMass = 120;
    } else if(this.sex === "M" && muscleMass >= 93.5) {
        muscleMass = 120;
    }

    return BodyMetrics.CHECK_OVERFLOW(muscleMass, 10, 120);
};

BodyMetrics.prototype.getMuscleMassScale = function() {
    let scale;
    BodyMetrics.MUSCLE_MASS_SCALES.some(s => {
        if(this.height >= s.min) {
            scale = s[this.sex];
            return true;
        }
    });

    return scale;
};

BodyMetrics.prototype.getVisceralFat = function(weight) {
    let subsubcalc;
    let subcalc;
    let vfal;

    if(this.sex === "F") {
        if(weight > (13 - (this.height * 0.5)) * -1) {
            subsubcalc = ((this.height * 1.45) + (this.height * 0.1158) * this.height) - 120;
            subcalc = this.weight * 500 / subsubcalc;
            vfal = (subcalc - 6) + (this.age * 0.07);
        } else {
            subcalc = 0.691 + (this.height * -0.0024) + (this.height * -0.0024);
            vfal = (((this.height * 0.027) - (subcalc * this.weight)) * -1) + (this.age * 0.07) - this.age;
        }
    } else {
        if(this.height < weight * 1.6) {
            subcalc = ((this.height * 0.4) - (this.height * (this.height * 0.0826))) * -1;
            vfal = ((weight * 305) / (subcalc + 48)) - 2.9 + (this.age * 0.15);
        } else {
            subcalc = 0.765 + this.height * -0.0015;
            vfal = (((this.height * 0.143) - (weight * subcalc)) * -1) + (this.age * 0.15) - 5.0;
        }
    }

    return BodyMetrics.CHECK_OVERFLOW(vfal, 1, 50);
};

BodyMetrics.prototype.getVisceralFatScale = function() {
    return [10, 15];
};

BodyMetrics.prototype.getBMI = function(weight) {
    return BodyMetrics.CHECK_OVERFLOW(weight/((this.height/100)*(this.height/100)), 10, 90);
};

BodyMetrics.prototype.getBMIScale = function() {
    return [18.5, 25, 28, 32];
};

//Get ideal weight (just doing a reverse BMI, should be something better)
BodyMetrics.prototype.getIdealWeight = function() {
    return BodyMetrics.CHECK_OVERFLOW((22*this.height)*this.height/10000, 5.5, 198);
};

//Get ideal weight scale (BMI scale converted to weights)
BodyMetrics.prototype.getIdealWeightScale = function() {
    return this.getBMIScale().map(v => (v*this.height)*this.height/10000)
};

//Get fat mass to ideal (guessing mi fit formula)
BodyMetrics.prototype.getFatMassToIdeal = function(weight, impedance) {
    const mass = (weight * (this.getFatPercentage(weight, impedance) / 100)) - (this.weight * (this.getFatPercentageScale()[2] / 100));

    if(mass < 0) {
        return {type: "to_gain", mass: mass*-1};
    } else {
        return {type: "to_lose", mass: mass};
    }
};

//Get protetin percentage (warn: guessed formula)
BodyMetrics.prototype.getProteinPercentage = function(weight, impedance) {
    let proteinPercentage = 100 - (Math.floor(this.getFatPercentage(weight, impedance) * 100) / 100);
    proteinPercentage -= Math.floor(this.getWaterPercentage(weight, impedance) * 100) / 100;
    proteinPercentage -= Math.floor((this.getBoneMass(weight, impedance)/weight*100) * 100) / 100;

    return proteinPercentage;
};

//Get protein scale (hardcoded in mi fit)
BodyMetrics.prototype.getProteinPercentageScale = function() {
    return [16, 20];
};

BodyMetrics.prototype.getBodyType = function(weight, impedance) {
    const fatPercentage = this.getFatPercentage(weight, impedance);
    const muscleMass = this.getMuscleMass(weight, impedance);
    let factor;

    if(fatPercentage > this.getFatPercentageScale()[2]) {
        factor = 0;
    } else if(fatPercentage < this.getFatPercentageScale()[1]) {
        factor = 2;
    } else {
        factor = 1;
    }

    if(muscleMass > this.getMuscleMassScale()[1]) {
        return BodyMetrics.BODY_TYPES[2 + (factor * 3)];
    } else if(muscleMass < this.getMuscleMassScale()[0]) {
        return BodyMetrics.BODY_TYPES[(factor * 3)];
    } else {
        return BodyMetrics.BODY_TYPES[1 + (factor * 3)];
    }
};


BodyMetrics.prototype.getAllMetrics = function(weight, impedance) {
    const measurements = {
        LBM: this.getLBMCoefficient(weight, impedance).toFixed(2),
        BodyFatPercentage: {
            value: this.getFatPercentage(weight, impedance).toFixed(2),
            scale: this.getFatPercentageScale()
        },
        WaterPercentage: {
            value: this.getWaterPercentage(weight, impedance).toFixed(2),
            scale: this.getWaterPercentageScale()
        },
        BoneMass: {
            value: this.getBoneMass(weight, impedance).toFixed(2),
            scale: this.getBoneMassScale(weight)
        },
        MuscleMass: {
            value: this.getMuscleMass(weight, impedance).toFixed(2),
            scale: this.getMuscleMassScale()
        },
        VisceralFat: {
            value: this.getVisceralFat(weight).toFixed(2),
            scale: this.getVisceralFatScale()
        },
        BMI: {
            value: this.getBMI(weight).toFixed(2),
            scale: this.getBMIScale()
        },
        BMR: {
            value: this.getBMR(weight).toFixed(2),
            scale: this.getBMRScale(weight).toFixed(2)
        },
        IdealWeight: {
            value: this.getIdealWeight().toFixed(2),
            scale: this.getIdealWeightScale().map(v => v.toFixed(2))
        },
        BodyType: this.getBodyType(weight, impedance)
    };

    return {
        lbm: measurements.LBM,
        bmi: measurements.BMI.value,

        fat_pct: measurements.BodyFatPercentage.value,
        water_pct: measurements.WaterPercentage.value,

        bone_mass_kg: measurements.BoneMass.value,
        muscle_mass_kg: measurements.MuscleMass.value,
        visceral_fat_mass_kg: measurements.VisceralFat.value,

        bmr_kcal: measurements.BMR.value,

        fat: BodyMetrics.GET_SCALE_VALUE_DESCRIPTION(
            measurements.BodyFatPercentage.value,
            measurements.BodyFatPercentage.scale,
            BodyMetrics.SCALE_DESCRIPTIONS.FAT_PCT
        ),
        water: BodyMetrics.GET_SCALE_VALUE_DESCRIPTION(
            measurements.WaterPercentage.value,
            measurements.WaterPercentage.scale,
            BodyMetrics.SCALE_DESCRIPTIONS.WATER_PCT
        ),
        bone_mass: BodyMetrics.GET_SCALE_VALUE_DESCRIPTION(
            measurements.BoneMass.value,
            measurements.BoneMass.scale,
            BodyMetrics.SCALE_DESCRIPTIONS.BONE_MASS
        ),
        muscle_mass: BodyMetrics.GET_SCALE_VALUE_DESCRIPTION(
            measurements.MuscleMass.value,
            measurements.MuscleMass.scale,
            BodyMetrics.SCALE_DESCRIPTIONS.MUSCLE_MASS
        ),
        visceral_fat: BodyMetrics.GET_SCALE_VALUE_DESCRIPTION(
            measurements.VisceralFat.value,
            measurements.VisceralFat.scale,
            BodyMetrics.SCALE_DESCRIPTIONS.VISCERAL_FAT_MASS
        ),
        bmi_class: BodyMetrics.GET_SCALE_VALUE_DESCRIPTION(
            measurements.BMI.value,
            measurements.BMI.scale,
            BodyMetrics.SCALE_DESCRIPTIONS.BMI
        ),
        body_type: measurements.BodyType
    }

};

BodyMetrics.GET_SCALE_VALUE_DESCRIPTION = function(val, scale, descriptions) {
    let desc;
    scale.some((s, i) => {
        if(val <= s) {
            desc = descriptions[i];
            return true;
        }
    });

    if(!desc) {
        desc = descriptions[descriptions.length -1];
    }

    return desc;
};

BodyMetrics.SCALE_DESCRIPTIONS = {
    FAT_PCT: [
        "Very Low",
        "Low",
        "Normal",
        "High",
        "Very High"
    ],
    WATER_PCT: [
        "Insufficient",
        "Normal",
        "Good"
    ],
    BONE_MASS: [
        "Insufficient",
        "Normal",
        "Good"
    ],
    MUSCLE_MASS: [
        "Insufficient",
        "Normal",
        "Good"
    ],
    VISCERAL_FAT_MASS: [
        "Normal",
        "High",
        "Very High"
    ],
    BMI: [
        "Underweight",
        "Normal",
        "Overweight",
        "Obese",
        "Morbidly Obese"
    ],
    BMR: [
        "Insufficient",
        "Normal"
    ]
};


BodyMetrics.BODY_TYPES = [
    'obese',
    'overweight',
    'thick-set',
    'lack-exerscise',
    'balanced',
    'balanced-muscular',
    'skinny',
    'balanced-skinny',
    'skinny-muscular'
];



BodyMetrics.MUSCLE_MASS_SCALES = [
    {'min': 170, 'F': [36.5, 42.5], 'M': [49.5, 59.4]},
    {'min': 160, 'F': [32.9, 37.5], 'M': [44.0, 52.4]},
    {'min': 0, 'F': [29.1, 34.7], 'M': [38.5, 46.5]}
];

BodyMetrics.BONE_MASS_SCALES = [
    {'F': {'min': 60, 'optimal': 2.5}, 'M': {'min': 75, 'optimal': 3.2}},
    {'F': {'min': 45, 'optimal': 2.2}, 'M': {'min': 69, 'optimal': 2.9}},
    {'F': {'min': 0, 'optimal': 1.8}, 'M': {'min': 0, 'optimal': 2.5}}
];

BodyMetrics.FAT_PERCENTAGE_SCALES = [
    {'min': 0, 'max': 20, 'F': [18, 23, 30, 35], 'M': [8, 14, 21, 25]},
    {'min': 21, 'max': 25, 'F': [19, 24, 30, 35], 'M': [10, 15, 22, 26]},
    {'min': 26, 'max': 30, 'F': [20, 25, 31, 36], 'M': [11, 16, 21, 27]},
    {'min': 31, 'max': 35, 'F': [21, 26, 33, 36], 'M': [13, 17, 25, 28]},
    {'min': 46, 'max': 40, 'F': [22, 27, 34, 37], 'M': [15, 20, 26, 29]},
    {'min': 41, 'max': 45, 'F': [23, 28, 35, 38], 'M': [16, 22, 27, 30]},
    {'min': 46, 'max': 50, 'F': [24, 30, 36, 38], 'M': [17, 23, 29, 31]},
    {'min': 51, 'max': 55, 'F': [26, 31, 36, 39], 'M': [19, 25, 30, 33]},
    {'min': 56, 'max': 100, 'F': [27, 32, 37, 40], 'M': [21, 26, 31, 34]},
];

BodyMetrics.BMR_COEFFICIENTS_BY_AGE_AND_SEX = {
    "M": {12: 36, 15: 30, 17: 26, 29: 23, 50: 21, 120: 20},
    "F": {12: 34, 15: 29, 17: 24, 29: 22, 50: 20, 120: 19}
};

BodyMetrics.CHECK_OVERFLOW = function(val, min, max) {
    if(val < min) {
        return min;
    } else if (val > max) {
        return max;
    } else {
        return val;
    }
};

module.exports = BodyMetrics;