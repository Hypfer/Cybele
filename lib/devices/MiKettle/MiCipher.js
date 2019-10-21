KEY_SIZE = 256;

module.exports = {
    /**
     *
     * @param mac {Buffer}
     * @param productId {number}
     */
    mixA: function(mac, productId) {
        if(!mac || mac.length !== 6) {
            throw new Error("Invalid mac")
        }
        return Buffer.from([
            mac[0],
            mac[2],
            mac[5],
            productId & 0xff,
            productId & 0xff,
            mac[4],
            mac[5],
            mac[1]
        ]);
    },
    /**
     *
     * @param mac {Buffer}
     * @param productId {number}
     */
    mixB: function(mac, productId) {
        if(!mac || mac.length !== 6) {
            throw new Error("Invalid mac")
        }
        return Buffer.from([
            mac[0],
            mac[2],
            mac[5],
            (productId >> 8) & 0xff,
            mac[4],
            mac[0],
            mac[5],
            productId & 0xff
        ]);
    },
    /**
     *
     * @param key {Buffer}
     * @param input {Buffer}
     */
    cipher: function(key, input) {
        const perm = Buffer.alloc(KEY_SIZE);
        const output = Buffer.alloc(input.length);

        //Init perm
        for(let i = 0; i < perm.length; i++) {
            perm[i] = i;
        }

        let j = 0;
        for(let i= 0; i < perm.length; i++) {
            const tmp = perm[i];

            j = (j + perm[i] + key[i%key.length])%256;

            perm[i] = perm[j];
            perm[j] = tmp;
        }

        let index1 = 0;
        let index2 = 0;

        for(let i = 0; i < input.length; i++) {
            let tmp;
            index1 = (index1+1)%256;
            index2 = (index2 + perm[index1])%256;

            tmp = perm[index1];
            perm[index1] = perm[index2];
            perm[index2] = tmp;

            output[i] = input[i] ^ perm[(perm[index1] + perm[index2])%256]
        }

        return output;
    }
};
