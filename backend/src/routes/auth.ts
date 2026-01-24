import { Router } from "express";
import { User } from "../models/Users";
import { hashPassword, signJwt, verifyPassword } from "../lib/auth";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

export const authRouter = Router();

/* ================= REGISTER ================= */

authRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};

    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "name, email, password needed",
      });
    }

    const exists = await User.findOne({
      email: String(email).toLowerCase(),
    }).lean();

    if (exists) {
      return res.status(400).json({
        ok: false,
        error: "Email already in use",
      });
    }

    const passwordHash = await hashPassword(String(password));

    const user = await User.create({
      name: String(name),
      email: String(email).toLowerCase(),
      passwordHash,
      isCreator: false,
    });

    return res.json({
      ok: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        isCreator: user.isCreator,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/* ================= LOGIN ================= */

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "email, password needed",
      });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase(),
    });

    if (!user) {
      return res.status(400).json({
        ok: false,
        error: "Invalid credentials",
      });
    }

    const okPassword = await verifyPassword(
      String(password),
      user.passwordHash
    );

    if (!okPassword) {
      return res.status(400).json({
        ok: false,
        error: "Invalid credentials",
      });
    }

    const token = signJwt({ userId: String(user._id) });

    res.cookie(process.env.COOKIE_NAME!, token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      ok: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        isCreator: user.isCreator,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/* ================= LOGOUT ================= */

authRouter.post("/logout", async (_req, res) => {
  try {
    res.clearCookie(process.env.COOKIE_NAME!, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});

/* ================= ME (PROTECTED) ================= */

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    return res.json({ ok: true, user: req.user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
});
