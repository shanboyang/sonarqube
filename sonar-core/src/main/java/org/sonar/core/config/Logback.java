/*
 * SonarQube, open source software quality management tool.
 * Copyright (C) 2008-2013 SonarSource
 * mailto:contact AT sonarsource DOT com
 *
 * SonarQube is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * SonarQube is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
package org.sonar.core.config;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.encoder.PatternLayoutEncoder;
import ch.qos.logback.classic.joran.JoranConfigurator;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.Appender;
import ch.qos.logback.core.ConsoleAppender;
import ch.qos.logback.core.joran.spi.JoranException;
import ch.qos.logback.core.util.StatusPrinter;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.slf4j.LoggerFactory;
import org.sonar.api.BatchComponent;
import org.sonar.api.ServerComponent;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

/**
 * Configure Logback
 *
 * @since 2.12
 */
public class Logback implements BatchComponent, ServerComponent {

  public static void configure(String classloaderPath, Map<String, String> substitutionVariables) {
    InputStream input = Logback.class.getResourceAsStream(classloaderPath);
    if (input == null) {
      throw new IllegalArgumentException("Logback configuration not found in classloader: " + classloaderPath);
    }
    configure(input, substitutionVariables);
  }

  public static void configure(File logbackFile, Map<String, String> substitutionVariables) {
    try {
      FileInputStream input = FileUtils.openInputStream(logbackFile);
      configure(input, substitutionVariables);
    } catch (IOException e) {
      throw new IllegalArgumentException("Fail to load the Logback configuration: " + logbackFile, e);
    }
  }

  /**
   * Note that this method closes the input stream
   */
  private static void configure(InputStream input, Map<String, String> substitutionVariables) {
    LoggerContext lc = (LoggerContext) LoggerFactory.getILoggerFactory();
    try {
      JoranConfigurator configurator = new JoranConfigurator();
      configurator.setContext(configureContext(lc, substitutionVariables));
      configurator.doConfigure(input);
      if (isConsoleEnabled(substitutionVariables)) {
        Logger rootLogger = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        rootLogger.setAdditive(false);
        rootLogger.addAppender(consoleAppender(lc, substitutionVariables));
      }
    } catch (JoranException e) {
      // StatusPrinter will handle this
    } finally {
      IOUtils.closeQuietly(input);
    }
    StatusPrinter.printInCaseOfErrorsOrWarnings(lc);
  }

  private static LoggerContext configureContext(LoggerContext context, Map<String, String> substitutionVariables) {
    context.reset();
    for (Map.Entry<String, String> entry : substitutionVariables.entrySet()) {
      context.putProperty(entry.getKey(), entry.getValue());
    }
    return context;
  }

  private static Boolean isConsoleEnabled(Map<String, String> substitutionVariables) {
    return Boolean.valueOf(substitutionVariables.get("CONSOLE_ENABLED"));
  }

  private static Appender<ILoggingEvent> consoleAppender(LoggerContext context, Map<String, String> substitutionVariables) {
    PatternLayoutEncoder encoder = new PatternLayoutEncoder();
    encoder.setPattern(substitutionVariables.get("CONSOLE_LOGGING_FORMAT"));
    encoder.setContext(context);
    encoder.start();
    ConsoleAppender<ILoggingEvent> console = new ConsoleAppender<ILoggingEvent>();
    console.setEncoder(encoder);
    console.setContext(context);
    console.start();
    return console;
  }

  public void setLoggerLevel(String loggerName, Level level) {
    ((ch.qos.logback.classic.Logger) LoggerFactory.getLogger(loggerName)).setLevel(level);
  }
}
