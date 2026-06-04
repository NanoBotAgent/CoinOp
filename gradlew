#!/bin/sh
# Gradle wrapper for GitHub Actions (Unix/Linux)
# Uses gradle/wrapper/gradle-wrapper.jar to bootstrap Gradle

APP_NAME="Gradle"

GRADLE_OPTS=""
DEFAULT_JVM_OPTS=""

# Resolve links: $0 may be a link
PRG="$0"
while [ -h "$PRG" ] ; do
    ls=`ls -ld "$PRG"`
    link=`expr "$ls" : '.*-> \(.*\)$'`
    if expr "$link" : '/.*' > /dev/null; then
        PRG="$link"
    else
        PRG=`dirname "$PRG"`"/$link"
    fi
done

# Get the directory of the script
PRGDIR=`dirname "$PRG"`
EXECUTABLE=gradle-wrapper.jar

# Check if wrapper jar exists
if [ ! -f "$PRGDIR/gradle/wrapper/$EXECUTABLE" ]; then
    echo "ERROR: $EXECUTABLE not found in $PRGDIR/gradle/wrapper/"
    exit 1
fi

# Set Java options if not set
if [ -z "$JAVA_HOME" ]; then
    JAVA_CMD="java"
else
    JAVA_CMD="$JAVA_HOME/bin/java"
fi

# Execute Gradle wrapper
exec "$JAVA_CMD" $DEFAULT_JVM_OPTS $JAVA_OPTS $GRADLE_OPTS \
  -jar "$PRGDIR/gradle/wrapper/$EXECUTABLE" "$@"
