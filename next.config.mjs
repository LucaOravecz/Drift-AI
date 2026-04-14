import * as Sentry from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
}

const withSentry = Sentry.withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
})

export default withSentry
