/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    basePath: '/guitar-tuner',
    assetPrefix: process.env.NODE_ENV === 'production' ? '/guitar-tuner/' : '',
};

export default nextConfig;
