const TABLE = "lotto_draws";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function normalizeNumbers(value) {
  if (!Array.isArray(value)) return null;

  const numbers = value.map((item) => Number(item)).filter(Number.isInteger);
  const unique = [...new Set(numbers)];
  unique.sort((a, b) => a - b);

  if (unique.length !== 6) return null;
  if (unique.some((number) => number < 1 || number > 45)) return null;

  return unique;
}

async function callSupabase(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    const error = new Error("Supabase environment variables are missing.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  return response;
}

async function handleGet(res) {
  const response = await callSupabase(
    `${TABLE}?select=id,numbers,bonus,created_at&order=created_at.desc&limit=5`,
  );

  if (!response.ok) {
    const details = await response.text();
    sendJson(res, response.status, {
      error: "Failed to load draws from Supabase.",
      details,
    });
    return;
  }

  const draws = await response.json();
  sendJson(res, 200, { draws });
}

async function handlePost(req, res) {
  const body = await readBody(req);
  const numbers = normalizeNumbers(body.numbers);
  const bonus = Number(body.bonus);

  if (!numbers || !Number.isInteger(bonus) || bonus < 1 || bonus > 45) {
    sendJson(res, 400, {
      error: "numbers must contain 6 unique lotto numbers and bonus must be 1-45.",
    });
    return;
  }

  if (numbers.includes(bonus)) {
    sendJson(res, 400, {
      error: "bonus must not duplicate one of the main numbers.",
    });
    return;
  }

  const response = await callSupabase(TABLE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ numbers, bonus }),
  });

  if (!response.ok) {
    const details = await response.text();
    sendJson(res, response.status, {
      error: "Failed to save draw to Supabase.",
      details,
    });
    return;
  }

  const saved = await response.json();
  sendJson(res, 200, { draw: saved[0] ?? null });
}

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      await handleGet(res);
      return;
    }

    if (req.method === "POST") {
      await handlePost(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, {
      error: error.message || "Internal server error.",
    });
  }
};
