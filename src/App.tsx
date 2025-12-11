import { useState } from 'react'

function App() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="text-center space-y-4 animate-in fade-in zoom-in duration-500">
                <h1 className="text-4xl font-bold tracking-tight text-primary">
                    Unicharm Operations <span className="text-foreground">v9</span>
                </h1>
                <p className="text-muted-foreground">
                    Premium. Robust. Refined.
                </p>
                <div className="p-6 border rounded-xl bg-card shadow-lg inline-block">
                    <div className="flex items-center gap-2 text-sm">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        System Online
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App
