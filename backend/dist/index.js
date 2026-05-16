"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const index_js_1 = require("./config/index.js");
const api_js_1 = __importDefault(require("./routes/api.js"));
const index_js_2 = __importDefault(require("./routes/index.js"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
app.use('/', index_js_2.default);
app.use('/api', api_js_1.default);
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    res.status(err.status || 500).json({ message: err.message || 'Something went wrong!' });
});
// Handle 404
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});
const PORT = index_js_1.config.port;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Gracefully shutdown after logging the error
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=index.js.map