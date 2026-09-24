import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { createClient } from "../lib/supabase";

export const server = {
  signUp: defineAction({
    accept: "form",
    input: z.object({
      email: z.string().email(),
      password: z.string().min(6),
    }),
    handler: async (input, context) => {
      try {
        const supabase = createClient({
          request: context.request,
          cookies: context.cookies,
        });

        const { error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            emailRedirectTo: "http://localhost:4321/auth/callback",
          },
        });

        if (error) {
          return {
            success: false,
            message: error.message,
          };
        }

        return {
          success: true,
          message: "Check your email to confirm your account",
        };
      } catch (err) {
        return {
          success: false,
          message: "Unexpected error",
        };
      }
    },
  }),
  signIn: defineAction({
    accept: "form",
    input: z.object({
      email: z.string().email(),
      password: z.string(),
    }),
    handler: async (input, context) => {
      try {
        const supabase = createClient({
          request: context.request,
          cookies: context.cookies,
        });

        const { error } = await supabase.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

        if (error) {
          return {
            success: false,
            message: error.message,
          };
        }

        return {
          success: true,
          message: "Signed in successfully",
        };
      } catch (err) {
        return {
          success: false,
          message: "Unexpected error",
        };
      }
    },
  }),
  signOut: defineAction({
    handler: async (_, context) => {
      try {
        const supabase = createClient({
          request: context.request,
          cookies: context.cookies,
        });

        await supabase.auth.signOut();

        return {
          success: true,
        };
      } catch (err) {
        return {
          success: false,
          message: "Failed to sign out",
        };
      }
    },
  }),
};
