
class CustomSuccess extends Error {
    constructor({ success = true, message = '', data = {}, statusCode = 200 }) {
        super(message);
        this.success = success;
        this.message = message;
        this.data = data;
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            success: this.success,
            message: this.message,
            data: this.data,
            statusCode: this.statusCode,
        };
    }
}

export default CustomSuccess;
