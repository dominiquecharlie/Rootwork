const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = require("./server");

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
