import http from "node:http";

interface OllamaResponse {
  message?: {
    content?: string;
  };
}

const serverPort = Number(process.env.PORT || 3000);
const ollamaApiUrl = "http://127.0.0.1:11434/api/chat";
const ollamaModel = "qwen2.5vl:7b";

const server = http.createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/analyze-screenshot") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const requestBody = await readRequestBody(request);
    const { imageDataUrl, prompt } = JSON.parse(requestBody) as {
      imageDataUrl?: string;
      prompt?: string;
    };

    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/png;base64,")) {
      sendJson(response, 400, { error: "imageDataUrl must be a PNG data URL." });
      return;
    }

    const ollamaResponse = await fetch(ollamaApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        messages: [
          {
            role: "user",
            content: prompt || "Identify the center coordinates of the button labeled Click me. Return only JSON with x and y coordinates relative to the image.",
            images: [imageDataUrl.slice("data:image/png;base64,".length)]
          }
        ]
      })
    });

    const ollamaResult = await ollamaResponse.json() as OllamaResponse;

    if (!ollamaResponse.ok) {
      sendJson(response, ollamaResponse.status, { error: ollamaResult });
      return;
    }

    sendJson(response, 200, {
      outputText: ollamaResult.message?.content || "",
      model: ollamaModel
    });
  } catch (error) {
    sendJson(response, 500, { error: getErrorMessage(error) });
  }
});

server.listen(serverPort, "127.0.0.1", () => {
  console.log(`Listening on http://localhost:${serverPort}`);
});

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const bodyChunks: Buffer[] = [];
    let bodyLength = 0;

    request.on("data", (chunk: Buffer) => {
      bodyLength += chunk.length;

      if (bodyLength > 20 * 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }

      bodyChunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(bodyChunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
