'use strict';
'require baseclass';
'require rpc';

const callCreateSocks5Profile = rpc.declare({
    object: 'luci.momo.socks5',
    method: 'create_socks5_profile',
    params: ['name', 'credentials'],
    expect: { '': {} }
});

return baseclass.extend({
    /**
     * Parse a SOCKS5 credential string: user:pass@host:port
     * Returns { username, password, server, server_port } or null.
     */
    parseCredentials: function(credentials) {
        if (!credentials) return null;
        const atIdx = credentials.lastIndexOf('@');
        if (atIdx < 0) return null;

        const auth = credentials.substring(0, atIdx);
        const hostPort = credentials.substring(atIdx + 1);

        const colonIdx = auth.indexOf(':');
        if (colonIdx < 0) return null;

        const username = auth.substring(0, colonIdx);
        const password = auth.substring(colonIdx + 1);
        if (!username || !password) return null;

        let server, server_port;
        if (hostPort.startsWith('[')) {
            // IPv6 [::1]:port
            const bracketEnd = hostPort.indexOf(']');
            if (bracketEnd < 0) return null;
            server = hostPort.substring(1, bracketEnd);
            const portPart = hostPort.substring(bracketEnd + 1);
            if (!portPart.startsWith(':')) return null;
            server_port = parseInt(portPart.substring(1), 10);
        } else {
            const lastColon = hostPort.lastIndexOf(':');
            if (lastColon < 0) return null;
            server = hostPort.substring(0, lastColon);
            server_port = parseInt(hostPort.substring(lastColon + 1), 10);
        }

        if (!server || isNaN(server_port) || server_port < 1 || server_port > 65535)
            return null;

        return { username, password, server, server_port };
    },

    /**
     * Validate and call the backend to create the SOCKS5 profile file.
     * @param {string} name        - destination filename (e.g. "my-proxy.json")
     * @param {string} credentials - "user:pass@host:port"
     * @returns Promise<{ success, error?, path? }>
     */
    createSocks5Profile: function(name, credentials) {
        return callCreateSocks5Profile(name, credentials);
    }
});
