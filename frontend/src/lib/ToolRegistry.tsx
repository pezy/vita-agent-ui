import React, { createContext, useContext, ReactNode } from 'react';

type ToolProps = {
    args: any;
    result?: any;
    events?: any[];
};

type ToolComponent = React.ComponentType<ToolProps>;

interface ToolRegistryContextType {
    getTool: (name: string) => ToolComponent | null;
    registerTool: (name: string, component: ToolComponent) => void;
}

const ToolRegistryContext = createContext<ToolRegistryContextType | undefined>(undefined);

export function ToolRegistryProvider({ children, initialTools = {} }: { children: ReactNode, initialTools?: Record<string, ToolComponent> }) {
    const [tools, setTools] = React.useState<Record<string, ToolComponent>>(initialTools);

    const getTool = (name: string) => tools[name] || null;

    const registerTool = (name: string, component: ToolComponent) => {
        setTools(prev => ({ ...prev, [name]: component }));
    };

    return (
        <ToolRegistryContext.Provider value={{ getTool, registerTool }}>
            {children}
        </ToolRegistryContext.Provider>
    );
}

export function useToolRegistry() {
    const context = useContext(ToolRegistryContext);
    if (!context) {
        throw new Error('useToolRegistry must be used within a ToolRegistryProvider');
    }
    return context;
}
