module.exports = function override(config) {
    // Find the source-map-loader rule
    const sourceMapRule = config.module.rules.find(rule => rule.loader && rule.loader.includes('source-map-loader'));
    console.log('sourceMapRule:', sourceMapRule); // Log the rule to inspect its structure

    if (sourceMapRule) {
        // Ensure exclude is an array
        if (!Array.isArray(sourceMapRule.exclude)) {
            sourceMapRule.exclude = sourceMapRule.exclude ? [sourceMapRule.exclude] : [];
        }
        // Add react-datepicker to the exclude array
        sourceMapRule.exclude.push(/node_modules\/react-datepicker/);
    }

    // Add Babel plugins to support modern JavaScript syntax (for MUI)
    const babelRule = config.module.rules.find(rule => {
        if (!rule) return false;
        if (Array.isArray(rule.use)) {
            return rule.use.some(u => u.loader && u.loader.includes('babel-loader'));
        }
        return rule.loader && rule.loader.includes('babel-loader');
    });

    if (babelRule) {
        if (Array.isArray(babelRule.use)) {
            babelRule.use.forEach(use => {
                if (use.loader && use.loader.includes('babel-loader')) {
                    use.options.plugins = [
                        ...(use.options.plugins || []),
                        '@babel/plugin-proposal-nullish-coalescing-operator',
                        '@babel/plugin-proposal-optional-chaining'
                    ];
                }
            });
        } else if (babelRule.loader && babelRule.loader.includes('babel-loader')) {
            babelRule.options.plugins = [
                ...(babelRule.options.plugins || []),
                '@babel/plugin-proposal-nullish-coalescing-operator',
                '@babel/plugin-proposal-optional-chaining'
            ];
        }
    }

    // Change Webpack's hash function to sha256 (from previous fix)
    config.output.hashFunction = 'sha256';

    return config;
};