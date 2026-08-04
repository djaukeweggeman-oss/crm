import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"WGMN Digital Administratie",description:"Eenvoudige bedrijfsadministratie van WGMN Digital",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="nl"><body>{children}</body></html>}
