"use client"

import { useUser, useClerk } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, User, Settings, FolderOpen } from "lucide-react"
import Link from "next/link"

export function UserMenu() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()

  if (!isLoaded) {
    return (
      <div className="h-9 w-9 rounded-full bg-secondary animate-pulse" />
    )
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
          <Link href="/sign-in">Sign In</Link>
        </Button>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" asChild>
          <Link href="/sign-up">Get Started</Link>
        </Button>
      </div>
    )
  }

  const initials = user.fullName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || user.emailAddresses[0]?.emailAddress.slice(0, 2).toUpperCase() || "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={user.imageUrl}
              alt={user.fullName || "User"}
            />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center gap-3 p-2">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={user.imageUrl}
              alt={user.fullName || "User"}
            />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-medium">
              {user.fullName || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[160px]">
              {user.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="cursor-pointer">
            <FolderOpen className="mr-2 h-4 w-4" />
            My Projects
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/user-profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut()}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
